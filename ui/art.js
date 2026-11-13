// A table's artwork. build.mjs inlines each table's images (tables/<id>/art.js) as window.TABLE_ART, a map of
// name -> data URL; loadArt turns them into decoded images, keyed by the same names. Tables without art get {}.
export async function loadArt(src = (typeof window !== 'undefined' && window.TABLE_ART) || {}) {
  const out = {};
  await Promise.all(Object.entries(src).map(([name, url]) => new Promise(done => {
    const img = new Image();
    img.onload = () => { out[name] = img; done(); };
    img.onerror = () => done();   // a missing image falls back to the plain drawing
    img.src = url;
  })));
  return out;
}
