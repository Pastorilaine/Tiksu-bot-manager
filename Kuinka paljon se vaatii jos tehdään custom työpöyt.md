<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Kuinka paljon se vaatii jos tehdään custom työpöytä sovellus joka on discord bottien hallintaa ja ylläpitoa varten tehty sovellus? Sovelluksen pitää olla asiakkaalle todella simppeli ja siinä pitää toimia python sekä javascript discord botit

Tässä kattava analyysi projektin laajuudesta, vaatimuksista ja teknologiavalinnoista:

***

## Teknologiavalinta: Electron

**Electron** on paras valinta tähän tarkoitukseen, koska se sisältää jo valmiiksi Node.js:n, joka kykenee käynnistämään sekä Python- että JavaScript-botteja suoraan `child_process`:n kautta ilman erillisiä asennuksia. Tauri olisi kevyempi (~10x pienempi paketti, ~58% vähemmän muistia), mutta se vaatii Rust-osaamista backendiin, mikä tekee Python-prosessien hallinnasta monimutkaisempaa. Discord itse, VS Code, Slack ja Figma käyttävät Electronia.[^1][^2]

***

## Sovelluksen ydinominaisuudet

### Botinhallinta (MVP)

- **Botti-lista** — lisää botti token + tyyppi (Python/JS) + käynnistystiedosto
- **Start / Stop / Restart** — napilla, ei terminaalia tarvita
- **Live-logi** — stdout/stderr striimaus reaaliajassa
- **Tila-indikaattori** — Online 🟢 / Offline 🔴 / Virhe 🟡
- **Auto-restart** — kaatumisen jälkeen automaattinen uudelleenkäynnistys


### Konfigurointi

- `.env`-tiedoston muokkaus UI:sta (key-value -editori)
- `config.json`-tuki
- Muuttujien salaus (token ei näy selkokielisenä)


### Lisäominaisuudet (v2)

- Usean botin samanaikainen hallinta
- CPU/RAM-käyttö per botti
- Webhook-notifikaatiot (Discord-kanava) jos botti kaatuu
- Automaattinen käynnistys Windowsin käynnistyksessä

***

## Tekninen pino

| Kerros | Teknologia | Tehtävä |
| :-- | :-- | :-- |
| **Desktop-kehys** | Electron v30+ | App-ikkuna, prosessit, IPC |
| **Frontend** | React + Vite | UI-komponentit |
| **Tyylit** | Tailwind CSS | Nopea tyylittely |
| **Python-runtime** | `child_process.spawn('python')` | Python-bottien käynnistys |
| **JS-runtime** | `child_process.spawn('node')` | JS-bottien käynnistys |
| **Logi-striimaus** | `stdout.on('data')` → IPC | Reaaliaikainen loki |
| **Konfiguraatio** | `electron-store` | Bottilistaus, asetukset |
| **Paketointi** | `electron-builder` [^3] | .exe / .dmg / .AppImage |


***

## Projektin työmääräarvio

### Vaihe 1 — MVP (toimiva perussovellus)

| Tehtävä | Arvio |
| :-- | :-- |
| Projektin pystytys (Electron + React + Vite) | 3–5 h |
| Bottien lisäys/poisto/listauksui | 8–12 h |
| Prosessinhallinta (start/stop/restart) | 10–15 h |
| Live-logi-näkymä | 6–10 h |
| Python + JS botin tunnistus \& käynnistys | 8–12 h |
| `.env` / `config.json` -editori | 6–8 h |
| UI-viimeistely ja testaus | 8–12 h |
| **Yhteensä MVP** | **~50–75 h** |

### Vaihe 2 — Lisäominaisuudet

| Tehtävä | Arvio |
| :-- | :-- |
| CPU/RAM-monitorointi | 6–10 h |
| Auto-restart + crash-ilmoitukset | 8–12 h |
| Windows autostart + tray-ikoni | 4–6 h |
| Installer (.exe setup wizard) | 4–8 h |
| **Yhteensä V2** | **~22–36 h** |

**Kokonaisarvio: ~72–111 tuntia** täysillä ominaisuuksilla.

***

## Haasteiden priorisointi

**Kriittisimmät tekniset haasteet:**

- **Python-ympäristö asiakkaan koneella** — asiakkaalla täytyy olla Python asennettuna. Ratkaisuna voi bundlata `python-embeddable` Electronin mukana, jolloin erillistä asennusta ei tarvita lainkaan.
- **Prosessien siivous** — kun app suljetaan, kaikki lapsi-prosessit (botit) täytyy tappaa puhtaasti `SIGTERM`-signaalilla, muuten botit jäävät taustalle pyörimään.
- **Windows vs. Linux** — `spawn`-kutsujen polut eroavat (`python3` vs `python`), tämä täytyy tunnistaa automaattisesti.

***

## Simppeliyden varmistaminen asiakkaalle

Käyttäjäkokemus pidetään yksinkertaisena rajoittamalla näkyvät toiminnot kolmeen:

1. **Lisää botti** → valitse tiedosto, syötä token
2. **Käynnistä / Pysäytä** → yksi nappi
3. **Katso loki** → scrollaava terminaali-ikkuna

Kaikki tekninen tapahtuu konepellin alla. Asiakkaan ei tarvitse koskaan avata komentoriviä.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://electronjs.org

[^2]: https://www.reddit.com/r/programming/comments/1jwjw7b/tauri_vs_electron_benchmark_58_less_memory_96/

[^3]: https://www.electron.build/index.html

[^4]: https://www.reddit.com/r/discordapp/comments/1kmguez/id_like_to_see_the_discord_desktop_app_switch/

[^5]: https://support.discord.com/hc/en-us/community/posts/18470216016919-Switch-from-Electron-to-Tauri-for-the-desktop-app

[^6]: https://news.ycombinator.com/item?id=26255925

[^7]: https://dev.to/finn001023cpu/i-built-a-gui-client-for-discord-bots-using-electron-react-open-source-i8d

[^8]: https://dev.to/nikolas_dimitroulakis_d23/cross-platform-desktop-wars-electron-vs-tauri-how-do-you-explain-the-tradeoffs-to-users-2948

[^9]: https://www.facebook.com/groups/devtitans/posts/1212234847743365/

[^10]: https://rustify.rs/articles/rust-tauri-vs-electron-2026

[^11]: https://github.com/moonlight-mod/discord-electron

[^12]: https://softwarelogic.co/en/blog/how-to-choose-electron-or-tauri-for-modern-desktop-apps

[^13]: https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/

[^14]: https://betterprogramming.pub/tauri-vs-electron-for-tray-apps-ed15974f35ce

[^15]: https://www.codecentric.de/en/knowledge-hub/blog/electron-tauri-building-desktop-apps-web-technologies

