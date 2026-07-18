// <schedule-net> — a rotating 3D activity-network for the Ordo7 blog featured card.
// Self-contained custom element; imports the vendored /vendor/three.module.js as an ES module —
// not a CDN, both per the design handoff's own production note and because this app's CSP
// (script-src 'self') would block a cross-origin script import anyway.
(function () {
  if (customElements.get('schedule-net')) return;

  class ScheduleNet extends HTMLElement {
    connectedCallback() {
      this.style.display = 'block';
      this.style.position = 'absolute';
      this.style.inset = '0';
      this._mx = 0; this._my = 0;
      this._boot();
    }
    disconnectedCallback() {
      this._alive = false;
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('mousemove', this._onMove);
      if (this._renderer) this._renderer.dispose && this._renderer.dispose();
    }
    async _boot() {
      let THREE;
      try {
        THREE = await import('/vendor/three.module.js');
      } catch (e) {
        this.style.background = 'radial-gradient(circle at 60% 40%, rgba(94,234,212,0.12), transparent 70%)';
        return;
      }
      this._alive = true;
      const w = this.clientWidth || 480, h = this.clientHeight || 460;

      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(48, w / h, 0.1, 100);
      cam.position.set(0, 0, 6.4);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.appendChild(renderer.domElement);
      renderer.domElement.style.display = 'block';
      this._renderer = renderer;

      const group = new THREE.Group();
      scene.add(group);

      // ---- build a network of nodes on a rough sphere ----
      const N = 26;
      const nodes = [];
      for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const phi = i * Math.PI * (3 - Math.sqrt(5));
        nodes.push(new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r).multiplyScalar(2.4));
      }

      const TEAL = 0x5eead4, AMBER = 0xf4b955, RED = 0xf2716a;
      // node spheres
      const nodeGeo = new THREE.SphereGeometry(0.062, 16, 16);
      nodes.forEach((p, i) => {
        const col = i % 9 === 0 ? RED : (i % 5 === 0 ? AMBER : TEAL);
        const m = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ color: col }));
        m.position.copy(p);
        group.add(m);
      });

      // edges: connect each node to its 2 nearest neighbors
      const linePos = [];
      nodes.forEach((a, i) => {
        const d = nodes.map((b, j) => ({ j, dist: a.distanceTo(b) })).filter(o => o.j !== i).sort((x, y2) => x.dist - y2.dist);
        for (let k = 0; k < 2; k++) {
          const b = nodes[d[k].j];
          linePos.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      });
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
      const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.28 }));
      group.add(lines);

      // faint inner wire sphere
      const wire = new THREE.Mesh(
        new THREE.IcosahedronGeometry(2.4, 1),
        new THREE.MeshBasicMaterial({ color: TEAL, wireframe: true, transparent: true, opacity: 0.06 })
      );
      group.add(wire);

      this._onResize = () => {
        const nw = this.clientWidth, nh = this.clientHeight;
        if (!nw || !nh) return;
        cam.aspect = nw / nh; cam.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      };
      window.addEventListener('resize', this._onResize);
      this._onMove = (e) => {
        const r = this.getBoundingClientRect();
        this._mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        this._my = ((e.clientY - r.top) / r.height - 0.5) * 2;
      };
      window.addEventListener('mousemove', this._onMove, { passive: true });

      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let t = 0;
      const tick = () => {
        if (!this._alive) return;
        t += 0.005;
        const spin = reduce ? 0.6 : t;
        group.rotation.y = spin + this._mx * 0.5;
        group.rotation.x = Math.sin(t * 0.6) * 0.18 + this._my * 0.4;
        renderer.render(scene, cam);
        requestAnimationFrame(tick);
      };
      tick();
    }
  }
  customElements.define('schedule-net', ScheduleNet);
})();
