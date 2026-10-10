"""Independent Python struct fixtures. Does not import or execute uploaded TI code."""
import struct,json,pathlib,math
out=pathlib.Path(__file__).parent
magic=b'\x02\x01\x04\x03\x06\x05\x08\x07'
def packet(tlvs,n=23,points=1):
 body=b''.join(struct.pack('<II',t,len(p))+p for t,p in tlvs)
 size=40+len(body);size=(size+31)//32*32
 return magic+struct.pack('<8I',0x03060000,size,0xa6843,n,12345,points,len(tlvs),0)+body+bytes(size-40-len(body))
track=struct.pack('<I27f',42,*([1,2,3,.1,.2,.3,0,0,0]+[0]*16+[4,.9]))
vitals=lambda id:struct.pack('<2H33f',id,17,.3,72,15,*[i*.1 for i in range(15)],*[i*.2 for i in range(15)])
fixtures={
 'cartesian':packet([(7,struct.pack('<2H',125,40)),(1,struct.pack('<4f',1,2,3,-.5)),(1010,track),(1011,b'\x2a'),(1012,struct.pack('<I2f',42,1.8,.1)),(1040,vitals(1)),(1040,vitals(2)),(9000,b'unknown')]),
 'spherical':packet([(1000,struct.pack('<4f',2,math.pi/2,0,-1))]),
 'compressed':packet([(1020,struct.pack('<5f',.01,.01,.1,.01,.1)+struct.pack('<bbhHH',-10,20,-4,300,125))]),
 'zero':packet([],points=0),
}
(out/'fixtures.json').write_text(json.dumps({k:list(v) for k,v in fixtures.items()}))
print('Generated four independent little-endian fixtures')
