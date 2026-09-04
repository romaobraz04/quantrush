let loader;
function loadProvider() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loader) loader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const timer = setTimeout(() => { script.remove(); loader = null; reject(new Error('Security check could not load. Check your connection and retry.')); }, 12000);
    script.onload = () => { clearTimeout(timer); if (window.turnstile) resolve(window.turnstile); else { script.remove(); loader = null; reject(new Error('Security check could not load. Check your connection and retry.')); } };
    script.onerror = () => { clearTimeout(timer); script.remove(); loader = null; reject(new Error('Security check could not load. Check your connection and retry.')); };
    document.head.append(script);
  });
  return loader;
}

export function createCaptcha(siteKey, container) {
  let widget = null, token = '', failure = '', generation = 0, mounting = null;
  return {
    async mount() {
      if (!siteKey || widget !== null) return;
      if (mounting) return mounting;
      const epoch = generation;
      const pending = (async () => {
        try {
          const provider = await loadProvider();
          if (epoch !== generation) return;
          failure = '';
          widget = provider.render(container, { sitekey: siteKey, size: window.matchMedia('(max-width: 420px)').matches ? 'compact' : 'flexible', theme: 'auto', callback: value => { token = value; failure = ''; }, 'expired-callback': () => { token = ''; }, 'error-callback': () => { token = ''; failure = 'Security check failed. Retry the security check.'; } });
        } catch (error) { if (epoch === generation) { failure = error.message; throw error; } }
        finally { if (epoch === generation) mounting = null; }
      })();
      mounting = pending;
      return pending;
    },
    token() {
      if (!siteKey) return undefined;
      if (!token) throw new Error(failure || 'Complete the security check before continuing.');
      return token;
    },
    reset() { token = ''; failure = ''; if (widget !== null) window.turnstile?.reset(widget); },
    remove() { generation++; mounting = null; token = ''; failure = ''; if (widget !== null) window.turnstile?.remove(widget); widget = null; },
  };
}
