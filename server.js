const express = require('express');
const axios = require('axios');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1);

app.use(session({
  secret: process.env.SESSION_SECRET || 'strafe_secret',
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    secure: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

let globalLeaderboard = [];

// Discord Giriş Başlatma (Doğrudan Discord'a Yönlendirir)
app.get('/api/auth/discord', (req, res) => {
  const clientId = process.env.CLIENT_ID;
  const redirectUri = encodeURIComponent(process.env.REDIRECT_URI);
  const scope = encodeURIComponent('identify email');
  
  const discordUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
  
  res.redirect(discordUrl);
});

app.get('/api/auth/discord/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/?error=no_code');

    // 1. Discord'dan Token Al
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) return res.redirect('/?error=token_failed');

    // 2. Kullanıcı Bilgilerini Çek
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `${tokenData.token_type} ${tokenData.access_token}` },
    });

    const userData = await userResponse.json();

    // 3. Oturumu Kaydet ve Yönlendir
    req.session.user = userData;

    // Oturumun tarayıcıya çerez olarak yazılmasını garantileyip öyle yönlendiriyoruz:
    req.session.save((err) => {
      if (err) {
        console.error("Session Save Error:", err);
        return res.redirect('/?error=session_save_failed');
      }
      res.redirect('/');
    });

  } catch (error) {
    console.error("Auth Error:", error);
    res.redirect('/?error=server_error');
  }
});
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
            : `https://cdn.discordapp.com/embed/avatars/${userData.discriminator % 5}.png`;

        req.session.user = {
            id: userData.id,
            username: userData.global_name || userData.username,
            avatar: avatarUrl
        };

        // Oturumu bellekten çereze yazıp yönlendirmeyi garantiye alıyoruz
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
app.get('/api/me', (req, res) => {
    res.json({ user: req.session.user || null });
});

app.post('/api/score', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Discord girişi gerekli.' });
    }

    const { score } = req.body;
    const user = req.session.user;

    const existingIndex = globalLeaderboard.findIndex(item => item.id === user.id);
    if (existingIndex !== -1) {
        if (score > globalLeaderboard[existingIndex].score) {
            globalLeaderboard[existingIndex].score = score;
            globalLeaderboard[existingIndex].avatar = user.avatar;
            globalLeaderboard[existingIndex].username = user.username;
        }
    } else {
        globalLeaderboard.push({
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            score
        });
    }

    globalLeaderboard.sort((a, b) => b.score - a.score);
    res.json({ success: true, leaderboard: globalLeaderboard });
});

app.get('/api/leaderboard', (req, res) => {
    res.json(globalLeaderboard);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`StrafeFlow Sunucusu Çalışıyor: http://localhost:${PORT}`);
});
// Ön yüzün oturum durumunu sorguladığı endpoint
app.get('/api/me', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();

    if (data.loggedIn) {
      // "Discord Bağla" butonunu gizle ve profil bilgisini göster
      const connectBtn = document.getElementById('discord-connect-btn'); // HTML'deki buton ID'si
      if (connectBtn) connectBtn.style.display = 'none';

      console.log('Giriş yapan kullanıcı:', data.user.username);
    }
  } catch (err) {
    console.error('Oturum kontrol hatası:', err);
  }
});