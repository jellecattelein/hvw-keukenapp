# HVW Keukenapp

Huis van Wonterghem Keukenplanning

https://jellecattelein.github.io/hvw-keukenapp

## GitHub token instellen (één keer, werkt daarna altijd)

Om `update_github.py` te laten draaien zonder telkens opnieuw je token te
moeten plakken, stel je hem één keer in als omgevingsvariabele op je PC.
Elke toekomstige versie van het script (ook uit nieuwe zips) vindt hem dan
automatisch.

1. Klik op **Start**, typ `omgevingsvariabelen`, kies **"Omgevingsvariabelen
   voor uw account bewerken"**.
2. Klik onder "Gebruikersvariabelen" op **Nieuw**.
3. Naam: `HVW_GITHUB_TOKEN`
4. Waarde: je GitHub personal access token (begint met `ghp_...`)
5. Klik OK, OK, OK om alles te bevestigen.
6. **Sluit en heropen** je Command Prompt-venster (de wijziging geldt pas in
   nieuwe vensters).

Test het met:
```
echo %HVW_GITHUB_TOKEN%
```
Zie je je token verschijnen, dan is het gelukt. Vanaf nu werkt
`update_github.py` — ook een gloednieuwe versie uit een nieuwe zip — meteen,
zonder dat je het bestand zelf nog moet aanpassen.

Moet je de token ooit vervangen (bv. na intrekken op GitHub), herhaal dan
gewoon stap 1-6 met de nieuwe waarde.
