# Automata Studio

Editor visuale in italiano per automi a stati finiti deterministici. Applicazione statica HTML, CSS e JavaScript, senza dipendenze da installare.

## Funzioni

- Creazione, modifica e trascinamento di stati e transizioni.
- Colori e tratteggi per distinguere gli archi, anche nel PNG; archi paralleli separati.
- Textbox sul grafo alla creazione e al doppio clic su nodi e archi; Invio conferma, Esc annulla.
- Scorciatoie S (nuovo stato), C (collega due nodi), Ctrl+Z / Cmd+Z (annulla) e Ctrl+Shift+Z / Cmd+Shift+Z (ripeti). Le scorciatoie del grafo non interferiscono con la digitazione nelle textbox.
- Delete/Canc elimina lo stato selezionato e i suoi archi; Ctrl+Z ripristina tutto. Nei campi di testo Delete modifica soltanto il testo. L’ultimo stato viene conservato.
- Zoom con rotellina e pulsanti, spostamento della vista trascinando lo sfondo.
- Salvataggio automatico nel browser delle posizioni dei nodi e dell’inquadratura.
- Simulazione passo per passo o automatica, con traccia e controllo delle ambiguità.
- Esportazione PNG e importazione/esportazione JSON.

## Avvio locale

```sh
python3 -m http.server 8765 --directory dist
```

Apri http://localhost:8765.

## Deploy su Vercel

Importa questa repository e usa la directory radice del progetto. `vercel.json` configura il preset Other, senza installazione o build, con directory di output `dist`.

Non sono necessarie variabili d’ambiente o servizi esterni. Il deploy su Vercel viene eseguito importando la repository nel proprio account.

Il salvataggio usa localStorage ed è specifico del browser e dell’origine del sito. Per trasferire un automa dal sito Sites al sito Vercel, esportalo in JSON e importalo sul nuovo sito.

## Struttura

- `dist/index.html`: interfaccia.
- `dist/style.css`: stile.
- `dist/app.js`: editor, simulazione e salvataggio.
- `.openai/hosting.json`: configurazione della pubblicazione Sites esistente.
- `vercel.json`: configurazione Vercel.
