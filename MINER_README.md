# Memecoin Miner Lite (v2)

Interface simples em Python/Tkinter que controla o **XMRig** minerando
RandomX (algoritmo do Monero) na pool **unMineable**, que converte e paga
na memecoin que você escolher: SHIB, DOGE, PEPE, FLOKI ou BONK.

## Como usar

1. Instale o **Python 3.8+** (no Windows, marque a opção "tcl/tk" no
   instalador — já vem marcada por padrão).
2. Baixe o XMRig oficial em <https://github.com/xmrig/xmrig/releases/latest>
   e coloque o binário (`xmrig.exe` no Windows, `xmrig` no Linux/macOS) na
   **mesma pasta** do `memecoin_miner_lite.py`.
   - Antivírus costumam alertar sobre mineradores; o XMRig oficial é
     código aberto. Baixe somente do repositório oficial acima.
3. Rode: `python memecoin_miner_lite.py`
4. Escolha a moeda, cole o **endereço público** da sua carteira (nunca a
   frase-semente/chave privada!), escolha o perfil de CPU e clique em
   **INICIAR MINERAÇÃO**.
5. Acompanhe o saldo pelo botão **"Ver saldo na unMineable"**. O pagamento
   é feito automaticamente quando o saldo atinge o mínimo da pool.

## Dicas para render mais

- Use o campo **código de convite** da unMineable: a taxa da pool cai de
  1% para 0,75% (você cria o seu em unmineable.com após o primeiro acesso).
- Perfis mais altos ("Forte", "Máximo") rendem mais, mas esquentam o
  computador. Em notebook, prefira até "Moderado" e mantenha a ventilação
  livre.
- Desmarque "Pausar enquanto eu estiver usando" apenas se não se importar
  com o computador mais lento durante o uso.
- No Windows, rodar uma vez como administrador permite que o XMRig ative
  *huge pages*, o que aumenta o hashrate.

## Expectativa realista de ganhos

Mineração de CPU em computador doméstico rende **pouco**: um notebook
típico faz algo entre 1 e 5 kH/s em RandomX, o que hoje equivale a poucos
centavos de dólar por dia — muitas vezes menos que o custo da energia
elétrica. Trate como experimento/aprendizado, não como fonte de renda.
Verifique também se mineração é permitida onde você mora e na sua conta
de energia/contrato (ex.: não minere em computador do trabalho).

## Segurança

- O programa só precisa do **endereço público** da carteira.
- A API de estatísticas do XMRig fica restrita a `127.0.0.1`, numa porta
  aleatória livre.
- A conexão com a pool usa TLS por padrão.
- Tudo roda visível e sob seu controle: o botão PARAR e o fechamento da
  janela encerram o XMRig imediatamente.
