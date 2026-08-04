/**
 * GestionPrésence — Serveur réseau local
 * ----------------------------------------
 * Ce serveur ne nécessite AUCUNE installation (pas de "npm install").
 * Il utilise uniquement les modules intégrés à Node.js.
 *
 * Utilisation :
 *   1. Installez Node.js (https://nodejs.org) sur l'ordinateur qui servira de serveur.
 *   2. Double-cliquez sur "demarrer.bat" (Windows) ou "demarrer.sh" (Mac/Linux),
 *      ou lancez : node server.js
 *   3. Gardez la fenêtre noire ouverte : c'est elle qui fait fonctionner le logiciel.
 *   4. Sur les tablettes / téléphones / autres PC connectés au MÊME Wi-Fi,
 *      ouvrez un navigateur et allez à l'adresse affichée dans la fenêtre
 *      (ex : http://192.168.1.25:3000)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
// DATA_DIR pointe par défaut vers le dossier du projet, mais peut être
// redirigé vers un volume persistant (ex: Railway) via la variable
// d'environnement DATA_DIR, pour que data.json survive aux redéploiements.
const DATA_DIR = process.env.DATA_DIR || ROOT;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const BACKUP_DIR = path.join(DATA_DIR, 'sauvegardes');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function defaultData() {
  return { employes: [], retards: [], absences: [], lid: 0, settings: { pin: '1234' } };
}

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (e) {
    return defaultData();
  }
}

function writeData(obj) {
  // Écriture atomique simple : fichier temporaire puis renommage
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, DATA_FILE);
}

// Sauvegarde automatique quotidienne (une copie horodatée par jour)
function backupIfNeeded() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);
    const today = new Date().toISOString().split('T')[0];
    const dest = path.join(BACKUP_DIR, `data-${today}.json`);
    if (!fs.existsSync(dest)) fs.copyFileSync(DATA_FILE, dest);
  } catch (e) {
    console.error('Sauvegarde automatique impossible :', e.message);
  }
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function serveStatic(req, res, urlPath) {
  const safePath = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Interdit');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Page introuvable : ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  // ----- API : lecture des données -----
  if (urlPath === '/api/data' && req.method === 'GET') {
    return sendJSON(res, 200, readData());
  }

  // ----- API : écriture des données -----
  if (urlPath === '/api/data' && req.method === 'POST') {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > 60 * 1024 * 1024) { // 60 Mo de sécurité (photos incluses)
        tooLarge = true;
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (tooLarge) return;
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        backupIfNeeded();
        writeData(body);
        sendJSON(res, 200, { ok: true });
      } catch (e) {
        sendJSON(res, 400, { ok: false, error: 'Données invalides' });
      }
    });
    return;
  }

  if (req.method === 'GET') {
    return serveStatic(req, res, urlPath);
  }

  res.writeHead(405);
  res.end('Méthode non autorisée');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('==========================================================');
  console.log('   GestionPrésence — le serveur est démarré !');
  console.log('==========================================================');
  console.log('');
  console.log('  Sur CET ordinateur, ouvrez :');
  console.log('    http://localhost:' + PORT);
  console.log('');
  console.log('  Sur les TABLETTES / TÉLÉPHONES / AUTRES PC connectés au');
  console.log('  MÊME réseau Wi-Fi, ouvrez un navigateur et allez à :');
  console.log('');
  const nets = os.networkInterfaces();
  let found = false;
  Object.values(nets).flat().forEach((net) => {
    if (net.family === 'IPv4' && !net.internal) {
      console.log('    ➜  http://' + net.address + ':' + PORT);
      found = true;
    }
  });
  if (!found) {
    console.log('    (Aucune adresse réseau détectée — vérifiez que le Wi-Fi');
    console.log('     ou le câble réseau de cet ordinateur est bien connecté.)');
  }
  console.log('');
  console.log('  ⚠️  Ne fermez PAS cette fenêtre : le logiciel s\'arrête si');
  console.log('      vous la fermez. Réduisez-la simplement.');
  console.log('');
  console.log('  Pour arrêter le serveur : fermez cette fenêtre (ou Ctrl+C).');
  console.log('==========================================================');
  console.log('');
});
