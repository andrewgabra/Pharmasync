// public/auth.js
// Handles Supabase Auth sign-in/sign-up/session + calling /api routes with
// the user's access token attached. Loaded before app.js.

const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const Auth = {
  session: null,
  profile: null,

  async init() {
    const { data } = await supabaseClient.auth.getSession();
    this.session = data?.session || null;
    if (this.session) await this.loadProfile();
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      this.session = session;
      if (session) await this.loadProfile();
      else this.profile = null;
      if (window.onAuthChange) window.onAuthChange();
    });
  },

  async loadProfile() {
    if (!this.session) { this.profile = null; return; }
    const { data } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', this.session.user.id)
      .single();
    this.profile = data || null;
  },

  get isLoggedIn() { return !!this.session; },
  get isAdmin() { return this.profile?.role === 'admin'; },
  get email() { return this.session?.user?.email || ''; },

  async signUp(email, password) {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    return { data, error };
  },
  async signIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (!error) { this.session = data.session; await this.loadProfile(); }
    return { data, error };
  },
  async signOut() {
    await supabaseClient.auth.signOut();
    this.session = null;
    this.profile = null;
  },

  // Calls one of our /api routes, attaching the bearer token automatically.
  async api(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.session?.access_token) headers.Authorization = `Bearer ${this.session.access_token}`;
    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    return res.json().catch(() => ({ ok: false, error: 'Invalid server response' }));
  },
};

window.Auth = Auth;
