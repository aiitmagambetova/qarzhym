// express-session үшін Firestore сақтағышы: sessions/{sid} = { data, expires }
module.exports = (session) => class FirestoreStore extends session.Store {
  constructor({ db, collection = 'sessions', ttl = 7 * 24 * 3600 * 1000 }) {
    super();
    this.col = db.collection(collection); this.ttl = ttl;
    this.timer = setInterval(() => this.clearExpired().catch(() => {}), 60 * 60 * 1000);
    if (this.timer.unref) this.timer.unref();
  }
  get(sid, cb) {
    this.col.doc(sid).get().then((s) => {
      if (!s.exists) return cb(null, null);
      const d = s.data();
      if (d.expires <= Date.now()) { this.col.doc(sid).delete().catch(() => {}); return cb(null, null); }
      cb(null, JSON.parse(d.data));
    }).catch(cb);
  }
  set(sid, sess, cb) {
    const exp = sess && sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + this.ttl;
    this.col.doc(sid).set({ data: JSON.stringify(sess), expires: exp }).then(() => cb && cb(null)).catch((e) => cb && cb(e));
  }
  destroy(sid, cb) { this.col.doc(sid).delete().then(() => cb && cb(null)).catch((e) => cb && cb(e)); }
  async clearExpired() {
    const snap = await this.col.where('expires', '<', Date.now()).limit(300).get();
    if (snap.empty) return;
    const b = this.col.firestore.batch(); snap.docs.forEach((d) => b.delete(d.ref)); await b.commit();
  }
};
