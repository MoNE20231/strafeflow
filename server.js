const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Render HTTPS yönlendirmeleri için trust proxy
app.set('trust proxy', 1);

// Session yapılandırması
app.use(session({
  secret: process.env.SESSION_SECRET || 'strafeflow_secret_key',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 1. Login başlatma
app.get('/api/auth/discord', (req, res) => {
  const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify`;
  res.redirect(discordUrl);
});

// 2. Discord Callback
app.get('/api/auth/discord/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=no_code');

  try {
    const tokenParam = new URLSearchParams({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.REDIRECT_URI
    });

    const tokenRes = await axios.post('https://discord.com/api/oauth2/token', tokenParam, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
    });

    const userData = userRes.data;
    const avatarUrl = userData.avatar 
      ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${(userData.discriminator || 0) % 5}.png`;

    req.session.user = {
      id: userData.id,
      username: userData.global_name || userData.username,
      avatar: avatarUrl
    };

    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('Session kaydetme hatası:', saveErr);
        return res.redirect('/?error=session_save_failed');
      }
      res.redirect('/');
    });

  } catch (err) {
    console.error('Discord Auth Hatası:', err?.response?.data || err.message);
    res.redirect('/?error=auth_failed');
  }
});

// 3. Frontend için Kullanıcı Bilgisi Sorgulama
app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// 4. Logout
app.get('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.listen(PORT, () => {
  console.log(`StrafeFlow Sunucusu Çalışıyor: http://localhost:${PORT}`);
});