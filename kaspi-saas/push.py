"""
Deploy changed files to VPS and restart services.
Usage: python push.py
"""
import paramiko
import os

HOST = "213.155.21.111"
USER = "root"
KEY_PATH = os.path.expanduser("~/.ssh/id_rsa")
REMOTE_BASE = "/root/kaspi-saas"
LOCAL_BASE = os.path.dirname(os.path.abspath(__file__))

FILES = [
    "frontend/src/pages/Products.jsx",
    "frontend/src/pages/Orders.jsx",
    "frontend/src/pages/Dashboard.jsx",
    "backend/api/analytics.py",
]

def connect(password=None):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    if password:
        client.connect(HOST, username=USER, password=password)
    else:
        try:
            client.connect(HOST, username=USER, key_filename=KEY_PATH)
        except Exception:
            import getpass
            pwd = getpass.getpass(f"SSH password for {USER}@{HOST}: ")
            client.connect(HOST, username=USER, password=pwd)
    return client

def run(client, cmd):
    print(f"  $ {cmd}")
    _, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        print(f"    {out}")
    if err:
        print(f"    ERR: {err}")
    return out

def main(password=None):
    print(f"Connecting to {HOST}...")
    client = connect(password)
    sftp = client.open_sftp()

    print("\nUploading files:")
    for rel_path in FILES:
        local = os.path.join(LOCAL_BASE, rel_path.replace("/", os.sep))
        remote = f"{REMOTE_BASE}/{rel_path}"
        remote_dir = remote.rsplit("/", 1)[0]
        try:
            sftp.stat(remote_dir)
        except FileNotFoundError:
            run(client, f"mkdir -p {remote_dir}")
        sftp.put(local, remote)
        print(f"  OK: {rel_path}")

    sftp.close()

    print("\nRestarting backend...")
    run(client, f"cd {REMOTE_BASE} && sudo docker compose restart backend")

    print("\nRebuilding frontend...")
    run(client, f"cd {REMOTE_BASE} && sudo docker compose build frontend && sudo docker compose up -d frontend")

    client.close()
    print("\nDone! http://213.155.21.111")

if __name__ == "__main__":
    import sys
    pwd = sys.argv[1] if len(sys.argv) > 1 else None
    main(pwd)
