"""Run on the server. Secret values are generated in memory and sent via stdin."""
import base64
import json
import secrets
import subprocess

def docker(*args, data=None):
    result = subprocess.run(['docker', *args], input=data, capture_output=True)
    if result.returncode:
        raise RuntimeError('Docker operation failed: ' + args[0])
    return result.stdout.decode().strip()

state = docker('info', '--format', '{{.Swarm.LocalNodeState}}')
if state == 'inactive':
    docker('swarm', 'init', '--advertise-addr', '192.168.100.236', '--listen-addr', '127.0.0.1:2377')
    print('Initialized single-server Docker Swarm for encrypted secrets')
elif state != 'active':
    raise RuntimeError('Unexpected Swarm state')

names = ['mongo-root', 'mongo-app', 'mongo-keyfile', 'mongodb-uri', 'jwt', 'api-token', 'messenger']
expected = {'erp-next-' + name + '-v1' for name in names}
existing = set(docker('secret', 'ls', '--format', '{{.Name}}').splitlines())
if expected <= existing:
    print('Dedicated encrypted secrets already exist; retained unchanged')
elif expected & existing:
    raise RuntimeError('Partial secret provisioning; do not rotate existing secrets automatically')
else:
    root = secrets.token_hex(32)
    app = secrets.token_hex(32)
    values = [root, app, base64.b64encode(secrets.token_bytes(512)).decode(),
              f'mongodb://erp_app:{app}@mongo:27017/erp_next?authSource=erp_next&replicaSet=erp-next-rs',
              secrets.token_hex(48), secrets.token_hex(32), secrets.token_hex(32)]
    for name, value in zip(names, values):
        docker('secret', 'create', 'erp-next-' + name + '-v1', '-', data=value.encode())
    print('Created 7 dedicated encrypted Docker secrets')

if 'erp-next-tracking-ingest-v1' not in existing:
    docker('secret', 'create', 'erp-next-tracking-ingest-v1', '-', data=secrets.token_hex(32).encode())
    print('Created dedicated encrypted tracking ingestion credential')
