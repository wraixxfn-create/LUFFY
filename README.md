# Luffy 3D — post-timeskip Monkey D. Luffy

A fully procedural, rig-friendly 3D character model of post-timeskip Monkey D. Luffy
(*One Piece*), built from the 17 supplied reference images, plus a browser viewer and a
glTF/GLB export.

No sculpting tools or external assets are used: every surface is generated in
JavaScript with three.js `BufferGeometry`, coloured with per-material colours, and
exported with `GLTFExporter`.

## Quick start

```bash
npm install
npm run dev        # viewer at http://localhost:5173
npm run export     # rebuild public/luffy.glb
npm run build      # production build (dist/)
```

The viewer loads `public/luffy.glb` and offers orbit/zoom, wireframe (W), turntable (R)
and view presets (1–6).

## Deliverables

| Path | What it is |
| --- | --- |
| `public/luffy.glb` | Binary glTF scene (≈2.6 MB, ~129 k triangles, 44 meshes, 17 materials) |
| `src/viewer/` | three.js viewer (OrbitControls, ACES tone mapping, studio environment) |
| `src/model/` | The procedural model: anatomy, clothing, head, materials |
| `tools/render.js` | Headless software rasterizer used for QA renders |
| `tools/export-glb.mjs` | GLB exporter (Node-side `FileReader` shim for `GLTFExporter`) |

## Model layout

- `src/model/proportions.js` — single source of truth for landmarks (sole 0, ankle, knee,
  crotch, sash, chest, shoulder, chin, skull top, eye line, wrist). Total height ≈ 1.9 m,
  centred on X, feet on y = 0.
- `src/model/lib/geom.js` — geometry helpers: `surface`, `shell` (double-sided garments),
  `revolve`, `tube`, `pathStations`, `mergeGeoms`, `blob`.
- `src/model/lib/materials.js` — colour palette (skin `#f5cca4`, vest `#bf2128`,
  shorts `#2b53a2`, sash `#efbb2b`, straw `#dcb96d`, band `#ae2a2a`, hair `#141419`) and
  the shared `MeshStandardMaterial` set.
- `src/model/body.js` — analytic torso (`torsoPoint`/`torsoNormal`/`torsoRadii` with pec,
  abdominal, oblique and glute deformation), neck, arms, hands (palm + four fingers +
  thumb), legs, feet with individual toes.
- `src/model/head.js` — skull and face surfacing, eyes (whites, pupil, highlight, lash
  line), brows, nose, mouth with a thin tooth row, the scar under the left eye, ears, hair
  (fringe, side strands, silhouette spikes) and the straw hat (domed crown, drooping brim,
  red band).
- `src/model/clothes.js` — open red vest with buttons and bell sleeves, blue shorts with a
  frayed white hem, yellow waist sash with knot and hanging tail, leather sandals with a
  rope thong, and the X-shaped chest scar.
- `src/model/luffy.js` — assembles every part into one named scene graph.

Garments are generated *from the same body surface functions* used for the skin, so the
vest, sash, shorts waistband and chest scar conform exactly to the torso instead of
floating. Limbs use parallel-transport frames, so no twisting or kinks appear at bends.

## QA

`tools/render.js` is a dependency-free rasterizer (z-buffer + two-light shading) so the
model can be checked without a browser:

```bash
node tools/render.js --views=front,side,back,threeq,face,feet,crotch --size=820x1080 --ss=2
```

Presets `feet`, `hands`, `chest` and `crotch` frame the details that are easiest to get
wrong.
