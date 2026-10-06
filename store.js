/* Kişisel CFO — yerel depolama, PIN şifreleme, yedekleme.
   Veriler YALNIZCA bu cihazın tarayıcı depolamasında tutulur; hiçbir sunucuya gönderilmez. */
(function (root) {
  'use strict';
  const KEY = 'kisiselcfo.data.v1';
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const ITER = 250000;

  async function deriveKey(pin, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptObj(obj, pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(pin, salt);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
    return { app: 'kisisel-cfo', enc: 'AES-GCM/PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  }
  async function decryptObj(box, pin) {
    const key = await deriveKey(pin, unb64(box.salt));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct));
    return JSON.parse(dec.decode(pt));
  }

  let pin = null;      // bellekte; asla diske yazılmaz
  let cache = null;

  const Store = {
    raw() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    exists() { return !!this.raw(); },
    isEncrypted() { const r = this.raw(); if (!r) return false; try { return !!JSON.parse(r).enc; } catch (e) { return false; } },
    hasPin() { return pin != null; },
    loadPlain() { const r = this.raw(); if (!r) return null; const o = JSON.parse(r); if (o.enc) throw new Error('locked'); cache = o; return o; },
    async unlock(p) { const box = JSON.parse(this.raw()); const o = await decryptObj(box, p); pin = p; cache = o; return o; },
    lock() { if (pin != null) { cache = null; pin = null; return true; } return false; },
    async save(data) {
      cache = data;
      const payload = pin != null ? JSON.stringify(await encryptObj(data, pin)) : JSON.stringify(data);
      try { localStorage.setItem(KEY, payload); } catch (e) { throw new Error('Depolama dolu veya erişilemiyor: ' + e.message); }
    },
    async setPin(p, data) { pin = p || null; await this.save(data); },
    wipe() { try { localStorage.removeItem(KEY); } catch (e) { } pin = null; cache = null; },
    async backupBlob(data) {
      const body = pin != null ? await encryptObj(data, pin) : Object.assign({ app: 'kisisel-cfo' }, data);
      return new Blob([JSON.stringify(body, null, pin != null ? 0 : 1)], { type: 'application/json' });
    },
    async parseBackup(text, askPin) {
      const o = JSON.parse(text);
      if (o.enc) { const p = await askPin(); if (p == null) throw new Error('İptal edildi'); return await decryptObj(o, p); }
      if (!o || typeof o !== 'object' || !('cards' in o || 'loans' in o || 'accounts' in o)) throw new Error('Bu dosya bir Kişisel CFO yedeği değil');
      delete o.app; return o;
    },
    async persist() {
      try { if (navigator.storage && navigator.storage.persist) { return (await navigator.storage.persisted()) || (await navigator.storage.persist()); } } catch (e) { }
      return false;
    },
    async usage() { try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (e) { } return null; },
  };
  root.CFOStore = Store;
})(window);
