(function(){
  const call=(op)=>window.__sb(JSON.stringify(op)).then(JSON.parse);
  function createClient(url,key,opts){
    const store={get(){try{return JSON.parse(localStorage.getItem('mock-session'))}catch(e){return null}},set(s){if(s)localStorage.setItem('mock-session',JSON.stringify(s));else localStorage.removeItem('mock-session')}};
    const listeners=[]; const uid=()=>{const s=store.get();return s?s.user.id:null};
    function builder(table){
      const q={table,action:'select',filters:[],order:null,limit:null,values:null,single:false};
      const b={select(){q.action=q.action==='select'?'select':q.action;return b},update(v){q.action='update';q.values=v;return b},delete(){q.action='delete';return b},
        in(col,vals){q.filters.push({col,vals});return b},order(c,o){q.order={col:c,asc:!o||o.ascending!==false};return b},limit(n){q.limit=n;return b},
        maybeSingle(){q.single=true;return run()},
        then(res,rej){return run().then(res,rej)}};
      function run(){return call({t:'from',q,uid:uid()})}
      return b;
    }
    return {auth:{
      async getSession(){return {data:{session:store.get()},error:null}},
      onAuthStateChange(cb){listeners.push(cb);return {data:{subscription:{unsubscribe(){}}}}},
      async signUp({email,password,options}){const r=await call({t:'signup',email,password,meta:options&&options.data});return r.error?{data:{user:null,session:null},error:r.error}:{data:{user:r.user,session:null},error:null}},
      async signInWithPassword({email,password}){const r=await call({t:'signin',email,password});if(r.error)return {data:{},error:r.error};store.set(r.session);return {data:{session:r.session,user:r.session.user},error:null}},
      async signOut(){store.set(null);listeners.forEach(f=>f('SIGNED_OUT',null));return {error:null}},
      async resend(){await call({t:'resend'});return {error:null}},
      async resetPasswordForEmail(email){await call({t:'reset',email});return {data:{},error:null}},
      async updateUser({password}){const r=await call({t:'setpw',uid:uid(),password});return {data:{},error:r.error||null}},
      async verifyOtp({token_hash,type}){const r=await call({t:'verify',token_hash,type});if(r.error)return {data:{},error:r.error};store.set(r.session);return {data:{session:r.session},error:null}},
      async exchangeCodeForSession(code){const p=localStorage.getItem('mock-oauth');if(!p||code!=='mock-oauth')return {data:{},error:{message:'code verifier not found'}};localStorage.removeItem('mock-oauth');const r=await call({t:'oauth',provider:JSON.parse(p).provider,email:window.__oauthEmail||'oauth@test.com',meta:window.__oauthMeta||{}});store.set(r.session);return {data:{session:r.session},error:null}},
      async signInWithOAuth({provider,options}){window.__oauthCall={provider,options};if(window.__oauthCancel){location.href=options.redirectTo+'?error=access_denied&error_description=user_cancelled';return {data:{},error:null}}localStorage.setItem('mock-oauth',JSON.stringify({provider}));location.href=options.redirectTo+'?code=mock-oauth';return {data:{url:'x'},error:null}},
      async refreshSession(){return {data:{session:store.get()},error:null}}
    },
    storage:{from(b){return {async upload(path,file,o){window.__uploads=(window.__uploads||[]).concat(path);window.__upTypes=(window.__upTypes||[]).concat([o&&o.contentType]);return {data:{path},error:null}},async createSignedUrl(path,ttl,o){window.__signed=path;return {data:{signedUrl:'http://localhost:8123/index.html#signed'},error:null}},async list(){return {data:[],error:null}},async remove(p){window.__removed=(window.__removed||[]).concat(p||[]);return {data:[],error:null}}}}},
    rpc(fn,args){return call({t:'rpc',fn,args:args||{},uid:uid()})},
    from(t){return builder(t)}};
  }
  window.supabase={createClient};
})();
