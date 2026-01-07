# Nmind Companion – Browser Extension

Extension navigateur pour **Nmind Companion**, servant d’interface entre les applications web et le **Nmind Companion Native Host** (application native) pour gérer :

- impression de documents,
- téléchargements et gestion de jobs,
- interactions monétiques / POS

> ⚙️ Ce dépôt contient **l’extension navigateur**.  
> L’hôte natif se trouve dans le dépôt : `Nmind-Companion-Native-Host`.

---

## Sommaire

- [Vue d’ensemble](#vue-densemble)
- [Fonctionnalités](#fonctionnalités)
- [Architecture technique](#architecture-technique)
- [Prérequis](#prérequis)
- [Installation et développement](#installation-et-développement)
  - [1. Cloner le dépôt](#1-cloner-le-dépôt)
  - [2. Installation des dépendances](#2-installation-des-dépendances)
  - [3. Build et mode développement](#3-build-et-mode-développement)
  - [4. Chargement dans le navigateur](#4-chargement-dans-le-navigateur)
- [Packaging / build de production](#packaging--build-de-production)
- [API et communication](#api-et-communication)
- [Structure des sources](#structure-des-sources)
- [Licence](#licence)

---

## Vue d’ensemble

Nmind Companion Browser Extension est une extension multi-navigateurs (Chrome / Firefox) qui :

- expose une **API JavaScript** côté page web pour dialoguer avec l’extension,
- communique avec un **Native Host** (`nmindcompanionhost`) via `nativeMessaging`,
- fournit des services de **téléchargement**, **impression** et **paiement électronique**,
- centralise la configuration (imprimantes, POS, options) via une UI d’options et une popup.

L’extension repose sur :

- un bus de **messagerie interne** (`nmind-messaging`) pour échanger entre :
  - page web ⇄ content script ⇄ background ⇄ Native Host
- une couche **core** (`nmind-core`) qui factorise :
  - la détection navigateur,
  - le logging,
  - le stockage des options.

---

## Fonctionnalités

- 🔌 **Connexion à l’hôte natif**
  - Détection de la présence de l’hôte `nmindcompanionhost`
  - Test de connexion, ping, récupération des capacités

- 🖨️ **Impression**
  - Liste des imprimantes disponibles
  - Envoi de jobs d’impression (fichiers / données binaires)
  - Suivi du statut via des jobs d’impression

- 💾 **Téléchargements**
  - Création de jobs de téléchargement
  - Suivi des jobs via un service dédié

- 💳 **Monétique / POS**
  - Gestion de périphériques de paiement (ports série, IP, protocoles…)
  - Ping / test de transaction via l’hôte natif

- ⚙️ **Interface utilisateur**
  - **Popup** : panneau de contrôle rapide (tests, état de la connexion, activation des services)
  - **Page d’options** : configuration avancée (imprimantes par défaut, POS, logs, etc.)
  - **Page web companion** (`companion.html`) : pour intégrer facilement l’API dans une appli web

---

## Architecture technique

L’extension est structurée autour de plusieurs couches :

- **Background script**
  - Point central de l’extension
  - Implémente les routes `companion.*` (ping, print, download, epayment, etc.)
  - Dialogue avec le Native Host via `NativeHostClient`

- **Content script**
  - Injecté sur les pages ciblées
  - Sert de relais entre la page et le background via `TabListener`
  - Gère des routes de démonstration (`content.ping`, `content.echo`, …)

- **Pages d’UI**
  - `popup/` : popup de l’extension
  - `settings/` : options / paramétrage
  - `companion.html` : page externe, intégrant `bundles/public.js` pour exposer l’API JS

- **Noyau partagé (`src/shared`)**
  - `nmind-core` : `browser`, `Logger`, `Storage`, `EventEmitter`
  - `nmind-messaging` : modèles de messages, routeurs, clients
  - `nmind-services` : services métier (impression, téléchargements)
  - `constants.js` : constantes (URLs, chemins, options par défaut)

---

## Prérequis

- **Node.js** (version LTS recommandée)
- **npm** (ou `yarn`)
- Un navigateur compatible **WebExtension** :
  - Google Chrome (ou Chromium / Edge)
  - Mozilla Firefox

Pour l’utilisation complète des fonctionnalités (impression, monétique, etc.), il faut également :

- l’installation du **Nmind Companion Native Host** sur la machine,
- la configuration du `nativeMessaging` (manifest natif) pour l’hôte `nmindcompanionhost`.

---

## Installation et développement

### 1. Cloner le dépôt

```bash
git clone https://github.com/nmind-io/Nmind-Companion-Browser-extension.git
cd Nmind-Companion-Browser-extension
```

### 2. Installation des dépendances

```
npm install
```

Les dépendances de développement incluent notamment :

- gulp, browserify, watchify
- webextension-polyfill
- outils de packaging (web-ext, gulp-zip, …)

### 3. Build et mode développement

Les builds sont différenciés par navigateur via la variable TARGET :

- Chrome – build et watch

```
# Build ponctuel
npm run chrome-build

# Rebuild automatique en dev
npm run chrome-watch
```

- Firefox – build et watch

```
# Build ponctuel
npm run firefox-build

# Rebuild automatique en dev
npm run firefox-watch
```

Les artefacts sont générés dans dist/<navigateur>/ (Chrome ou Firefox).
### 4. Chargement dans le navigateur

#### Chrome / Chromium / Edge

- Ouvrir chrome://extensions
- Activer Mode développeur
- Cliquer sur Charger l’extension non empaquetée
- Sélectionner le dossier : dist/chrome

#### Firefox

- Ouvrir about:debugging#/runtime/this-firefox
- Cliquer sur Charger un module complémentaire temporaire
- Sélectionner le fichier manifest.json dans : dist/firefox

## Packaging / build de production

Pour construire les deux versions (Chrome & Firefox) en mode production :

```
npm run build
```

Pour générer des packages (archives) prêts à être distribués :

```
npm run package

# ou bien
npm run chrome-package
npm run firefox-package
```

Les packages sont produits dans les dossiers de sortie configurés par Gulp (dist/).

## API et communication

L’extension expose une API de messagerie basée sur des messages typés :
- Request (nom de route + paramètres)
- Response (code + contenu)
- Success, Failure, Unknown, ScriptError

### 1. Page web
Utilise ExtensionClient (exposé via bundles/public.js) pour envoyer des requêtes :

```
supportClient.send('companion.ping').then(response => {
  console.log('Companion OK', response);
});
```

### 2. Content script

TabListener écoute les événements DOM et relaie les requêtes vers le background.

### 3. Background

BackgroundListener route les messages vers les handlers companion.*, qui utilisent :

- NativeHostClient pour parler à l’hôte natif,
- downloadService / printerService pour les jobs.

### 4. Native Host
Répond avec un message structuré (code, content, message, etc.), renvoyé jusqu’à la page.

## Structure des sources

```
src/
  manifest.json          # Manifest WebExtension
  _locales/              # i18n (en, fr)
  assets/                # CSS, icônes, images
  background/            # Background script (app.js, utils.js, ...)
  content/               # Content scripts
  popup/                 # Fichiers de la popup
  settings/              # Page d’options
  public/                # Support côté page web (ExtensionClient)
  lib/                   # Librairies tierces (jQuery, Bootstrap, polyfill)
  shared/
    nmind-core.js        # browser, Logger, Storage...
    nmind-misc.js
    EventEmitter.js
    LoggerWrapper.js
    Storage.js
    constants.js
    nmind-messaging/     # Message, Endpoint, clients...
    nmind-services/      # Print/Download services
```

## Licence
Ce projet est publié sous licence MIT.

MIT License

Copyright (c) 2019-2026 Nmind.io / osp@nmind.io

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
