/**
 * export-glb.mjs — build the model headlessly and write public/luffy.glb
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { createLuffy } from '../src/model/luffy.js';

// Minimal FileReader shim so three's GLTFExporter can run headlessly in Node.
if (typeof globalThis.FileReader === 'undefined') {
  class NodeFileReader {
    constructor() { this.result = null; this.onloadend = null; this.onerror = null; }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        if (this.onloadend) this.onloadend();
      }).catch((e) => { if (this.onerror) this.onerror(e); });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        const b64 = Buffer.from(buf).toString('base64');
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
        if (this.onloadend) this.onloadend();
      }).catch((e) => { if (this.onerror) this.onerror(e); });
    }
  }
  globalThis.FileReader = NodeFileReader;
}

const out = process.argv[2] || 'public/luffy.glb';
const root = createLuffy();
root.updateMatrixWorld(true);

const exporter = new GLTFExporter();
const buffer = await new Promise((resolve, reject) => {
  exporter.parse(root, (res) => resolve(res), (err) => reject(err), {
    binary: true,
    onlyVisible: true,
    truncateDrawRange: true,
  });
});
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(buffer));
const kb = (fs.statSync(out).size / 1024).toFixed(1);
let tris = 0;
root.traverse((o) => { if (o.isMesh) tris += o.geometry.index.count / 3; });
console.log(`wrote ${out} (${kb} KB, ${tris.toFixed(0)} triangles)`);
