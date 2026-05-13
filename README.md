<p align="center">
  <img src="tiksu_bots_trans.png" alt="Tiksu Bots" width="220" />
</p>

<h1 align="center">Tiksu Bot Manager</h1>

<p align="center">
  Windows-sovellus Discord-bottien hallintaan — käynnistä, pysäytä ja seuraa bottejasi yhdessä paikassa.
</p>

<p align="center">
  <a href="https://github.com/Pastorilaine/Tiksu-bot-manager/releases/latest">
    <img src="https://img.shields.io/github/v/release/Pastorilaine/Tiksu-bot-manager?label=Uusin%20versio&color=5865F2" alt="Uusin versio" />
  </a>
  <img src="https://img.shields.io/badge/Alusta-Windows%2010%2F11-blue" alt="Windows 10/11" />
</p>

---

## Lataus ja asennus

1. Avaa [Releases-sivu](https://github.com/Pastorilaine/Tiksu-bot-manager/releases/latest)
2. Lataa tiedosto nimeltä **`Tiksu.Bot.Manager.Setup.x.x.x.exe`**
3. Avaa ladattu tiedosto ja seuraa asennusohjetta
4. Sovellus ilmestyy työpöydälle ja käynnistyy automaattisesti asennuksen jälkeen

> **Huom:** Windows saattaa näyttää varoituksen tuntemattomasta julkaisijasta — klikkaa **Lisätiedot → Suorita joka tapauksessa** jatkaaksesi asennusta.

### Järjestelmävaatimukset

| | |
|---|---|
| Käyttöjärjestelmä | Windows 10 tai Windows 11 (64-bit) |
| Levy | ~200 MB asennukseen |
| Verkko | Tarvitaan päivitystarkistuksiin |

---

## Ominaisuudet

- **Usean botin hallinta** — lisää niin monta bottia kuin tarvitset, jokaisella omat asetukset
- **Käynnistys / pysäytys / uudelleenkäynnistys** yhdellä klikkauksella
- **Reaaliaikaiset lokit** — näe mitä botti tulostaa ja suodata pelkät virheet
- **Ympäristömuuttujat (.env)** — hallitse tokeneja ja asetuksia turvallisesti sovelluksessa
- **Automaattiset päivitykset** — sovellus ilmoittaa uudesta versiosta ja lataa sen puolestasi
- **Automaattinen käynnistyksen uudelleenyritys** — botti käynnistetään uudelleen, jos se kaatuu

---

## Käyttöohje

### Botin lisääminen

1. Klikkaa **Lisää botti** sivupalkin yläosasta
2. Anna botille nimi
3. Valitse botin **käynnistystiedosto** (yleensä `index.js`, `bot.py` tms.)
4. Jos botilla on `.env`-tiedosto, klikkaa **Tuo .env-tiedostosta** ja valitse se — ympäristömuuttujat täytetään automaattisesti
5. Klikkaa **Tallenna**

### Botin käynnistäminen

- Valitse botti sivupalkista
- Klikkaa **Käynnistä** — botin tila muuttuu **Online**-tilaan
- Lokit ilmestyvät oikeaan paneeliin reaaliajassa

### Lokien seuranta

- **Kaikki** — näyttää kaiken tulostuksen
- **Virheet** — näyttää vain virhelokit (punainen luku osoittaa virhelokien määrän)
- Lokit vierittyvät automaattisesti alas, kun uutta tulostusta tulee
- Klikkaa **Tyhjennä lokit** nollataksesi näkymän

### Ympäristömuuttujat (.env)

Botin `.env`-tiedosto sisältää yleensä arkaluonteisia tietoja kuten Discord-tokenin. Sovellus tallentaa nämä paikallisesti omaan tiedostoonsa — ei `.env`-tiedostoon levyllä.

- Voit lisätä, muokata ja poistaa muuttujia suoraan sovelluksesta
- Muutosten jälkeen **käynnistä botti uudelleen**, jotta uudet arvot tulevat voimaan

---

## Päivitykset

Sovellus tarkistaa päivitykset automaattisesti:

- **Käynnistyksen yhteydessä** — noin 5 sekuntia sovelluksen avaamisen jälkeen
- **Tunnin välein** — niin kauan kuin sovellus on auki
- **Käsin** — klikkaa sivupalkin alareunan **Tarkista**-nappia milloin tahansa

Kun uusi versio on saatavilla, sovelluksen yläreunaanilmestyy ilmoitusbanneri:

1. Klikkaa **Lataa päivitys** — lataus alkaa taustalla
2. Kun lataus on valmis, klikkaa **Asenna ja käynnistä uudelleen**
3. Sovellus sulkeutuu, asentaa päivityksen ja käynnistyy uudelleen

---

## Ongelmatilanteet

**Botti ei käynnisty**
- Tarkista, että käynnistystiedoston polku on oikein botin asetuksissa
- Varmista, että botti toimii myös terminaalissa suoraan ajettuna
- Tarkista virhelokit Virheet-välilehdeltä

**`.env` ei toimi**
- Muista käynnistää botti uudelleen muutosten jälkeen
- Varmista, että avain-arvo-parit ovat muodossa `AVAIN=arvo`

**Sovellus näyttää "Päivityksen tarkistus epäonnistui"**
- Tarkista internetyhteys
- Klikkaa bannerin X sulkeaksesi sen ja yritä uudelleen myöhemmin

**Windows estää asennuksen**
- Klikkaa **Lisätiedot** → **Suorita joka tapauksessa** asennusdialogissa

---

## Tuki

Ongelmatilanteissa ota yhteyttä **IT-Veljekset Group** -tiimiin tai avaa [GitHub Issue](https://github.com/Pastorilaine/Tiksu-bot-manager/issues).

