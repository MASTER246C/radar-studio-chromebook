"""Independent protocol fixtures. No vendor source is imported or executed."""
import json,struct,pathlib
magic=bytes([2,1,4,3,6,5,8,7])
def packet(tlvs,n=7):
 body=b''.join(struct.pack('<II',kind,len(payload))+payload for kind,payload in tlvs)
 length=((40+len(body)+31)//32)*32
 return magic+struct.pack('<8I',0x03060000,length,0xa6843,n,1000,0,len(tlvs),0)+body+bytes(length-40-len(body))
fixtures={
 'gesture':packet([(1050,struct.pack('<10f',-2,3,-4,1.5,20,.1,.2,.3,.4,.5)),(1051,struct.pack('<10f',.01,.91,.01,.01,.01,.01,.01,.01,.01,.01))]),
 'speed_valid':packet([(1033,struct.pack('<f?3x',-1.25,True))]),
 'speed_invalid':packet([(1033,struct.pack('<f?3x',99.0,False))]),
 'speed_unpadded':packet([(1033,struct.pack('<f?',1,True))]),
 'bad_probability':packet([(1051,struct.pack('<10f',1.1,*([0]*9)))]),
 'short_gesture':packet([(1050,struct.pack('<9f',*([0]*9)))]),
}
pathlib.Path(__file__).with_name('expansion-fixtures.json').write_text(json.dumps({k:list(v) for k,v in fixtures.items()}))
print('Generated 6 independent expansion fixtures')
