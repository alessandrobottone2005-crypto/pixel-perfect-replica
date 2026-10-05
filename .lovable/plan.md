# Collegare il progetto a GitHub

## Nota importante

Lovable non può collegarsi a un repository GitHub **già esistente** (come `pixel-perfect-replica`). La sincronizzazione GitHub di Lovable crea sempre un **nuovo repository** con il codice del progetto. Il collegamento si fa dall'interfaccia di Lovable, non dalla chat.

## Passi da seguire (nell'editor Lovable)

1. Apri il menu **Plus (+)** in basso a sinistra nella casella della chat → **GitHub** → **Connect project**.
2. Autorizza la **Lovable GitHub App** sul tuo account GitHub.
3. Seleziona l'account GitHub (es. `alessandrobottone2005-crypto`) dove creare il repository.
4. Clicca **Create Repository**: Lovable genera un nuovo repo con tutto il codice del progetto.

Da quel momento la sincronizzazione è bidirezionale e automatica:
- ogni modifica fatta in Lovable viene committata sul repo;
- ogni push su GitHub (anche da un IDE locale) torna in Lovable.

## Se vuoi usare proprio il repo "pixel-perfect-replica"

Opzioni:
- **Svuotare il repo esistente** e copiarci il codice: scarica il codice da Lovable (Code Editor → Download codebase, oppure dal nuovo repo creato da Lovable) e fai push nel tuo repository esistente con git.
- **Rinominare/eliminare** il repo esistente e lasciare che Lovable ne crei uno nuovo, poi rinominarlo in `pixel-perfect-replica` dalle impostazioni GitHub (la sync continua a funzionare).

## Cosa farò io

Nessuna modifica al codice è necessaria: il progetto è già pronto per essere esportato. Dopo il collegamento, posso aiutarti a verificare che la sync funzioni.
