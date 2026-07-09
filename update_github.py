#!/usr/bin/env python3
"""
HVW Keukenapp — GitHub Auto-Update Script
==========================================
Upload automatisch alle bestanden naar GitHub Pages.

Gebruik:
  1. Zet je GitHub token in de variabele GITHUB_TOKEN hieronder
  2. Dubbelklik op dit script of voer uit: python update_github.py

Je token aanmaken:
  github.com → Settings → Developer settings → Personal access tokens
  → Tokens (classic) → Generate new token
  → Selecteer: repo (volledige toegang)
  → Kopieer de token
"""

import os
import base64
import json
import urllib.request
import urllib.error

# ══ CONFIGURATIE ══
GITHUB_TOKEN = "JOUW_TOKEN_HIER"   # ← vervang dit
GITHUB_USER  = "jellecattelein"
GITHUB_REPO  = "hvw-keukenapp"
BRANCH       = "main"
# ══════════════════

API = f"https://api.github.com/repos/{GITHUB_USER}/{GITHUB_REPO}/contents"

HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "User-Agent": "HVW-Keukenapp-Updater"
}

def api_request(url, method="GET", data=None):
    req = urllib.request.Request(url, headers=HEADERS, method=method)
    if data:
        req.data = json.dumps(data).encode()
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise Exception(f"HTTP {e.code}: {body}")

def get_sha(path):
    """Haal SHA op van bestaand bestand (nodig voor update)."""
    try:
        result = api_request(f"{API}/{path}?ref={BRANCH}")
        return result.get("sha")
    except:
        return None

def upload_file(local_path, remote_path):
    """Upload of update een bestand op GitHub."""
    with open(local_path, "rb") as f:
        content = base64.b64encode(f.read()).decode()
    
    sha = get_sha(remote_path)
    data = {
        "message": f"Update {remote_path}",
        "content": content,
        "branch": BRANCH
    }
    if sha:
        data["sha"] = sha
    
    api_request(f"{API}/{remote_path}", method="PUT", data=data)
    status = "bijgewerkt" if sha else "nieuw"
    print(f"  ✓ {remote_path} ({status})")

def main():
    print("=" * 50)
    print("HVW Keukenapp — GitHub Update")
    print("=" * 50)
    
    if GITHUB_TOKEN == "JOUW_TOKEN_HIER":
        print("\n⚠️  Vul eerst je GitHub token in in dit script!")
        print("   Regel 20: GITHUB_TOKEN = \"JOUW_TOKEN_HIER\"")
        input("\nDruk Enter om af te sluiten...")
        return
    
    # Bestanden om te uploaden
    script_dir = os.path.dirname(os.path.abspath(__file__))
    bestanden = [
        ("index.html",              "index.html"),
        ("manifest.json",           "manifest.json"),
        ("sw.js",                   "sw.js"),
        ("assets/app.js",           "assets/app.js"),
        ("assets/style.css",        "assets/style.css"),
        ("assets/suppliers.js",     "assets/suppliers.js"),
        ("assets/ijsdesserts.js",   "assets/ijsdesserts.js"),
        ("assets/etiketten.js",     "assets/etiketten.js"),
        ("assets/cars.js",          "assets/cars.js"),
        ("assets/tijdstool.js",     "assets/tijdstool.js"),
        ("assets/broodjes.js",      "assets/broodjes.js"),
        ("assets/recepten.js",      "assets/recepten.js"),
        ("assets/logo.png",         "assets/logo.png"),
        ("assets/icon-192.png",     "assets/icon-192.png"),
        ("assets/icon-512.png",     "assets/icon-512.png"),
    ]
    
    print(f"\nUploaden naar {GITHUB_USER}/{GITHUB_REPO}...\n")
    
    fouten = []
    for local, remote in bestanden:
        local_full = os.path.join(script_dir, local)
        if not os.path.exists(local_full):
            print(f"  ⚠ Overgeslagen: {local} (niet gevonden)")
            continue
        try:
            upload_file(local_full, remote)
        except Exception as e:
            fouten.append((remote, str(e)))
            print(f"  ✗ {remote}: {e}")
    
    print(f"\n{'=' * 50}")
    if fouten:
        print(f"⚠️  {len(fouten)} fout(en) opgetreden")
    else:
        print(f"✅ {len(bestanden)} bestanden succesvol geüpload!")
        print(f"\n🌐 App live op:")
        print(f"   https://{GITHUB_USER}.github.io/{GITHUB_REPO}")
        print(f"\nGitHub Pages werkt de site bij binnen 1-2 minuten.")
    print("=" * 50)
    input("\nDruk Enter om af te sluiten...")

if __name__ == "__main__":
    main()
