/* ARNOUR — live settings.
   These two values are safe to publish: the key is the project's public (publishable) key.
   Access to data is enforced by the database rules, not by hiding this key.
   Leave both empty to run the local demo instead. */
window.ARNOUR_CONFIG = {
  url: 'https://refardkcseixbcaauabo.supabase.co',
  key: 'sb_publishable_6ycFGEqbq9RAc1Fi1163Hg_JY7DqefQ',
  legalDate: 'October 2026',
  /* sign-in with Google / LinkedIn: providers switched on in Supabase > Authentication > Sign In / Providers */
  oauth: ['google', 'linkedin_oidc'],
  /* Cloudflare Turnstile (bot check on sign-up, sign-in and password reset). Public key; the secret lives in Supabase. */
  turnstileSiteKey: '0x4AAAAAAFadzsiE4NdC2-3G',
  /* Google Ads measurement (public values, not secrets). Leave id empty and nothing is loaded and no consent bar is shown.
     id:    the Google Ads tag ID, e.g. 'AW-123456789'
     convC: conversion label for "professional profile completed" (the part after the slash in AW-123456789/AbCdEfGhIjK)
     convE: conversion label for "company profile completed" */
  ads: { id: '', convC: '', convE: '' }
};
