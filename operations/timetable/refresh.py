#!/usr/bin/env python3
"""Keep the last-good school timetable warm without user traffic."""
import json,sys,urllib.request
try:
 request=urllib.request.Request('http://127.0.0.1:3000/api/timetable?grade=1&class=1&refresh=1',headers={'Host':'cbgpu.com','User-Agent':'CBGPU-TimetableMonitor/1.0'})
 with urllib.request.urlopen(request,timeout=100) as response:data=json.load(response)
 if not data.get('grid'):raise ValueError('Empty timetable')
 print(json.dumps({'ok':True,'stale':bool(data.get('stale')),'fetchedAt':data.get('fetchedAt'),'weekStart':data.get('weekStart')}))
 if data.get('stale'):sys.exit(1)
except Exception:
 print('Timetable refresh failed; check provider availability and the last-good cache.',file=sys.stderr);sys.exit(1)
