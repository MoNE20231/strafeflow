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

app.use(session({
    secret: process.env.SESSION_SECRET || 'strafe_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

let globalLeaderboard = [];

app.get('/api/auth/discord', (req, res) => {
    const redirectUri = encodeURIComponent(process.env.REDIRECT_URI);
    const url = `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
    res.redirect(url);
});

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
            : `https://cdn.discordapp.com/embed/avatars/${userData.discriminator % 5}.png`;

        req.session.user = {
            id: userData.id,
            username: userData.global_name || userData.username,
            avatar: avatarUrl
        };

        res.redirect('/');
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