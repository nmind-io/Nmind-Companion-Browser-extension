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

