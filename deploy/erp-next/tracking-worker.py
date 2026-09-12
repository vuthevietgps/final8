"""Read-only Ladifinal snapshot connector; acknowledgements live on a separate volume."""
import datetime
from contextlib import closing
import hashlib
import ipaddress
import json
import os
import sqlite3
import time
import urllib.request

SOURCE = '/source/database.db'
STATE = '/state/ack.sqlite'
ENDPOINT = 'http://backend:3000/api/tracking-ingest/visits'
HOST = 'nghiepvuvantai.com'

def utc(value):
    parsed = datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=datetime.timezone.utc)
    return parsed.astimezone(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')

def map_visit(row):
    ads = {'provider': 'google'}
    for source, target in [('click_id_type','clickIdType'), ('click_id','clickId'),
                           ('campaign_id','campaignId'), ('ad_group_id','adGroupId'),
                           ('keyword','keyword'), ('network','network'), ('device','device'), ('match_type','matchType')]:
        if row[source]:
            ads[target] = str(row[source])
    result = {'externalVisitId': row['visit_token'], 'occurredAt': utc(row['occurred_at']),
              'landingHost': HOST, 'landingPath': row['landing_path'], 'ads': ads,
              'engagement': {target: int(row[source] or 0) for source, target in
                             [('page_views','pageViews'), ('engaged_seconds','engagedSeconds'),
                              ('max_scroll','maxScroll'), ('contact_actions','contactActions'), ('form_submits','formSubmits')]}}
    if row['ip_address']:
        result['ipAddress'] = str(ipaddress.ip_address(row['ip_address']))
    for source, target in [('country','country'), ('landing_name','landingName')]:
        if row[source]:
            result[target] = str(row[source])
    return result

def send_batch(batch, state):
    if not batch:
        return 0
    with open('/run/secrets/tracking_ingest_token', encoding='utf8') as file:
        token = file.read().strip()
    visits = [item[0] for item in batch]
    request = urllib.request.Request(ENDPOINT, data=json.dumps({'visits':visits}).encode(),
        headers={'Content-Type':'application/json', 'X-Tracking-Key':token}, method='POST')
    # Endpoint is a fixed internal service URL. Never forward the credential through redirects.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs): return None
    with urllib.request.build_opener(NoRedirect).open(request, timeout=20) as response:
        result = json.loads(response.read(4096))
    if result.get('accepted') != len(batch):
        raise RuntimeError('Incomplete acknowledgement')
    with state:
        state.executemany('INSERT INTO ack(visit_id,digest) VALUES(?,?) ON CONFLICT(visit_id) DO UPDATE SET digest=excluded.digest',
                          [(item[0]['externalVisitId'],item[1]) for item in batch])
    return len(batch)

def scan():
    sent = skipped = rejected = 0
    with closing(sqlite3.connect(STATE)) as state:
        state.execute('CREATE TABLE IF NOT EXISTS ack(visit_id TEXT PRIMARY KEY,digest TEXT NOT NULL)')
        with closing(sqlite3.connect('file:' + SOURCE + '?mode=ro', uri=True, timeout=5)) as source:
            source.row_factory = sqlite3.Row
            # The production source currently uses DELETE journaling. Fail closed if that changes:
            # a single-file read-only mount cannot safely read a separate WAL file.
            if source.execute('PRAGMA journal_mode').fetchone()[0].lower() != 'delete':
                raise RuntimeError('Source journaling requires connector reconfiguration')
            cursor = 0
            while True:
                rows = source.execute('SELECT * FROM ad_click_visits WHERE id>? ORDER BY id LIMIT 200', (cursor,)).fetchall()
                if not rows: break
                batch = []
                for row in rows:
                    cursor = row['id']
                    try: visit = map_visit(row)
                    except (ValueError, TypeError):
                        rejected += 1
                        continue
                    digest = hashlib.sha256(json.dumps(visit,sort_keys=True).encode()).hexdigest()
                    ack = state.execute('SELECT digest FROM ack WHERE visit_id=?',(visit['externalVisitId'],)).fetchone()
                    if ack and ack[0] == digest:
                        skipped += 1
                        continue
                    visit['observedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
                    batch.append((visit,digest))
                    if len(batch) == 25:
                        sent += send_batch(batch,state)
                        batch = []
                sent += send_batch(batch,state)
    status = {'sent':sent,'unchanged':skipped,'rejected':rejected,'lastSuccessAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
    with open('/state/status.json.tmp','w',encoding='utf8') as file: json.dump(status,file)
    os.replace('/state/status.json.tmp','/state/status.json')
    print(json.dumps(status),flush=True)
    return status

if __name__ == '__main__':
    while True:
        try: scan()
        except Exception as error:
            # Never print error bodies, credentials, IPs or raw source records.
            print(json.dumps({'sync':'failed','errorType':type(error).__name__}),flush=True)
        time.sleep(30)
