import importlib.util
from contextlib import closing
import os
import tempfile
import unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('worker',os.path.join(os.path.dirname(__file__),'tracking-worker.py'))
worker=importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

class MappingTests(unittest.TestCase):
    def row(self):
        return dict(visit_token='test-visit',occurred_at='2026-09-09 01:02:03',landing_path='/',landing_name='homepage',
                    ip_address='192.0.2.10',country='VN',click_id_type='gclid',click_id='test-click',campaign_id='raw-campaign-name',
                    ad_group_id='123',keyword=None,network=None,device='m',match_type=None,
                    page_views=2,engaged_seconds=50,max_scroll=75,contact_actions=2,form_submits=1)
    def test_legacy_time_is_utc_and_campaign_stays_raw(self):
        result=worker.map_visit(self.row())
        self.assertEqual(result['occurredAt'],'2026-09-09T01:02:03Z')
        self.assertEqual(result['ads']['campaignId'],'raw-campaign-name')
        self.assertNotIn('accountId',result['ads'])
        self.assertEqual(result['engagement']['contactActions'],2)
        self.assertNotIn('events',result)
    def test_invalid_ip_is_rejected(self):
        row=self.row();row['ip_address']='not-an-ip'
        with self.assertRaises(ValueError):worker.map_visit(row)
    def test_retry_and_late_engagement_update(self):
        import sqlite3
        with tempfile.TemporaryDirectory() as folder:
            source=os.path.join(folder,'source.db');state=os.path.join(folder,'state.db')
            row=self.row()
            with closing(sqlite3.connect(source)) as db, db:
                db.execute('CREATE TABLE ad_click_visits(id INTEGER PRIMARY KEY,'+','.join(k+' TEXT' for k in row)+')')
                db.execute('INSERT INTO ad_click_visits VALUES('+','.join('?' for _ in range(len(row)+1))+')',[1,*row.values()])
            real_replace=os.replace
            def replace(a,b):real_replace(os.path.join(folder,'status.json.tmp'),os.path.join(folder,'status.json'))
            real_open=open
            def mapped_open(path,*args,**kwargs):return real_open(path.replace('/state/',folder+'/'),*args,**kwargs)
            received=[]
            def send(batch,db):
                received.extend(x[0] for x in batch)
                with db:db.executemany('INSERT OR REPLACE INTO ack VALUES(?,?)',[(v['externalVisitId'],digest) for v,digest in batch])
                return len(batch)
            with patch.object(worker,'SOURCE',source),patch.object(worker,'STATE',state),patch('builtins.open',mapped_open),patch.object(worker.os,'replace',replace):
                with patch.object(worker,'send_batch',side_effect=RuntimeError('unavailable')):
                    with self.assertRaises(RuntimeError):worker.scan()
                with patch.object(worker,'send_batch',side_effect=send):
                    self.assertEqual(worker.scan()['sent'],1)
                    self.assertEqual(worker.scan()['sent'],0)
                    with closing(sqlite3.connect(source)) as db, db:db.execute('UPDATE ad_click_visits SET engaged_seconds=90')
                    self.assertEqual(worker.scan()['sent'],1)
                    self.assertEqual(received[-1]['engagement']['engagedSeconds'],90)

if __name__=='__main__':unittest.main()
