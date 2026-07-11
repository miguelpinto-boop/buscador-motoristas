"""Memecoin Miner Lite - CPU (v2)

Interface gráfica simples que controla o XMRig minerando RandomX na pool
unMineable, que paga na memecoin escolhida (SHIB, DOGE, PEPE, FLOKI, BONK).

Requisitos:
  1. Python 3.8+ (apenas biblioteca padrão).
  2. Binário oficial do XMRig na mesma pasta deste script:
     - Windows: xmrig.exe
     - Linux/macOS: xmrig
     Download oficial: https://github.com/xmrig/xmrig/releases

Melhorias em relação à v1:
  - Validação do endereço da carteira específica por moeda.
  - Conexão TLS com a pool (opcional, ligada por padrão).
  - Porta da API local escolhida automaticamente (evita conflito).
  - Reinício automático do XMRig em caso de queda (com limite).
  - Configuração salva/carregada automaticamente (miner_config.json).
  - Campo de código de convite da unMineable (reduz a taxa de 1% p/ 0,75%).
  - Perfis extras de CPU e proteções opcionais (bateria / uso ativo).
  - Estatísticas extras: uptime, shares aceitas/rejeitadas.
  - Botão para conferir o saldo direto no site da pool.
  - Huge pages habilitadas quando disponíveis (mais hashrate).
"""

import json
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import tkinter as tk
import urllib.request
import webbrowser
from pathlib import Path
from tkinter import messagebox, ttk


POOL_TLS = "rx.unmineable.com:443"
POOL_TCP = "rx.unmineable.com:3333"

PERFIS = {
    "Muito leve (10%)": 0.10,
    "Leve (20%)": 0.20,
    "Moderado (35%)": 0.35,
    "Forte (60%)": 0.60,
    "Máximo (90%)": 0.90,
}

# Regex básica do formato de endereço da rede padrão de pagamento
# de cada moeda na unMineable.
MOEDAS = {
    "SHIB": (r"^0x[0-9a-fA-F]{40}$", "ERC-20 (começa com 0x, 42 caracteres)"),
    "DOGE": (r"^D[1-9A-HJ-NP-Za-km-z]{25,40}$", "Dogecoin (começa com D)"),
    "PEPE": (r"^0x[0-9a-fA-F]{40}$", "ERC-20 (começa com 0x, 42 caracteres)"),
    "FLOKI": (r"^0x[0-9a-fA-F]{40}$", "ERC-20 (começa com 0x, 42 caracteres)"),
    "BONK": (
        r"^[1-9A-HJ-NP-Za-km-z]{32,44}$",
        "Solana (base58, 32-44 caracteres)",
    ),
}

MAX_REINICIOS = 3


def pasta_do_app():
    """Retorna a pasta do script ou do executável criado pelo PyInstaller."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def encontrar_xmrig():
    """Procura o binário do XMRig na pasta do app e no PATH."""
    nome = "xmrig.exe" if os.name == "nt" else "xmrig"
    candidato = pasta_do_app() / nome

    if candidato.is_file():
        return candidato

    no_path = shutil.which("xmrig")
    if no_path:
        return Path(no_path)

    return None


def porta_livre():
    """Pede ao sistema uma porta TCP livre para a API local do XMRig."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class MineradorApp:
    ARQUIVO_CONFIG = "miner_config.json"

    def __init__(self, root):
        self.root = root
        self.root.title("Memecoin Miner Lite - CPU (v2)")
        self.root.geometry("560x640")
        self.root.resizable(False, False)

        self.processo_minerador = None
        self.arquivo_log = None
        self.encerrando = False
        self.porta_api = None
        self.inicio_mineracao = None
        self.reinicios = 0
        self.minerando_desejado = False

        self.moeda_var = tk.StringVar(value="SHIB")
        self.perfil_var = tk.StringVar(value="Muito leve (10%)")
        self.tls_var = tk.BooleanVar(value=True)
        self.pausa_bateria_var = tk.BooleanVar(value=True)
        self.pausa_uso_var = tk.BooleanVar(value=True)
        self.status_var = tk.StringVar(value="Status: parado")
        self.hashrate_var = tk.StringVar(value="Hashrate: -- H/s")
        self.shares_var = tk.StringVar(value="Shares: --")
        self.uptime_var = tk.StringVar(value="Tempo minerando: --")
        self.threads_var = tk.StringVar(value="Threads estimadas: --")
        self.dica_carteira_var = tk.StringVar(value="")

        self.montar_interface()
        self.carregar_config()
        self.atualizar_previsao_threads()
        self.atualizar_dica_carteira()

        self.perfil_var.trace_add(
            "write", lambda *_: self.atualizar_previsao_threads()
        )
        self.moeda_var.trace_add(
            "write", lambda *_: self.atualizar_dica_carteira()
        )

        # Garante que o XMRig seja encerrado junto com a janela.
        self.root.protocol("WM_DELETE_WINDOW", self.fechar_app)

        # Verifica periodicamente se o minerador continua funcionando.
        self.root.after(1000, self.monitorar_processo)

    # ------------------------------------------------------------------
    # Interface
    # ------------------------------------------------------------------
    def montar_interface(self):
        frame = ttk.Frame(self.root, padding=18)
        frame.pack(fill="both", expand=True)

        ttk.Label(
            frame,
            text="Memecoin Miner Lite",
            font=("Arial", 17, "bold"),
        ).pack(pady=(0, 4))

        ttk.Label(
            frame,
            text=(
                "O XMRig minera RandomX; a unMineable converte e paga "
                "na moeda escolhida."
            ),
            wraplength=500,
            justify="center",
        ).pack(pady=(0, 14))

        ttk.Label(frame, text="Moeda de recebimento:").pack(anchor="w")

        self.menu_moedas = ttk.Combobox(
            frame,
            textvariable=self.moeda_var,
            values=list(MOEDAS.keys()),
            state="readonly",
            width=18,
        )
        self.menu_moedas.pack(anchor="w", pady=(3, 8))

        ttk.Label(frame, text="Endereço público da carteira:").pack(anchor="w")

        self.entrada_carteira = ttk.Entry(frame, width=64)
        self.entrada_carteira.pack(anchor="w", pady=(3, 2))

        ttk.Label(
            frame,
            textvariable=self.dica_carteira_var,
            foreground="gray",
        ).pack(anchor="w", pady=(0, 8))

        ttk.Label(
            frame,
            text="Código de convite unMineable (opcional, taxa 1% → 0,75%):",
        ).pack(anchor="w")

        self.entrada_refcode = ttk.Entry(frame, width=24)
        self.entrada_refcode.pack(anchor="w", pady=(3, 8))

        ttk.Label(frame, text="Perfil de uso do processador:").pack(anchor="w")

        self.menu_perfil = ttk.Combobox(
            frame,
            textvariable=self.perfil_var,
            values=list(PERFIS.keys()),
            state="readonly",
            width=22,
        )
        self.menu_perfil.pack(anchor="w", pady=(3, 2))

        ttk.Label(frame, textvariable=self.threads_var).pack(
            anchor="w", pady=(0, 8)
        )

        self.check_tls = ttk.Checkbutton(
            frame,
            text="Conexão criptografada com a pool (TLS)",
            variable=self.tls_var,
        )
        self.check_tls.pack(anchor="w")

        self.check_bateria = ttk.Checkbutton(
            frame,
            text="Pausar quando estiver na bateria",
            variable=self.pausa_bateria_var,
        )
        self.check_bateria.pack(anchor="w")

        self.check_uso = ttk.Checkbutton(
            frame,
            text="Pausar enquanto eu estiver usando o computador",
            variable=self.pausa_uso_var,
        )
        self.check_uso.pack(anchor="w", pady=(0, 8))

        self.botao_iniciar = tk.Button(
            frame,
            text="INICIAR MINERAÇÃO",
            bg="#188038",
            fg="white",
            activebackground="#137333",
            activeforeground="white",
            font=("Arial", 12, "bold"),
            command=self.alternar_mineracao,
            width=24,
            height=2,
        )
        self.botao_iniciar.pack(pady=8)

        self.botao_saldo = ttk.Button(
            frame,
            text="Ver saldo na unMineable",
            command=self.abrir_pagina_saldo,
        )
        self.botao_saldo.pack()

        ttk.Separator(frame).pack(fill="x", pady=10)

        ttk.Label(
            frame,
            textvariable=self.status_var,
            font=("Arial", 10, "bold"),
            wraplength=500,
            justify="center",
        ).pack()

        ttk.Label(frame, textvariable=self.hashrate_var).pack(pady=(6, 0))
        ttk.Label(frame, textvariable=self.shares_var).pack()
        ttk.Label(frame, textvariable=self.uptime_var).pack()

    # ------------------------------------------------------------------
    # Configuração persistente
    # ------------------------------------------------------------------
    def caminho_config(self):
        return pasta_do_app() / self.ARQUIVO_CONFIG

    def carregar_config(self):
        try:
            with open(self.caminho_config(), encoding="utf-8") as arquivo:
                dados = json.load(arquivo)
        except (OSError, ValueError):
            return

        if dados.get("moeda") in MOEDAS:
            self.moeda_var.set(dados["moeda"])

        if dados.get("perfil") in PERFIS:
            self.perfil_var.set(dados["perfil"])

        self.entrada_carteira.insert(0, dados.get("carteira", ""))
        self.entrada_refcode.insert(0, dados.get("refcode", ""))
        self.tls_var.set(bool(dados.get("tls", True)))
        self.pausa_bateria_var.set(bool(dados.get("pausa_bateria", True)))
        self.pausa_uso_var.set(bool(dados.get("pausa_uso", True)))

    def salvar_config(self):
        dados = {
            "moeda": self.moeda_var.get(),
            "carteira": self.entrada_carteira.get().strip(),
            "refcode": self.entrada_refcode.get().strip(),
            "perfil": self.perfil_var.get(),
            "tls": self.tls_var.get(),
            "pausa_bateria": self.pausa_bateria_var.get(),
            "pausa_uso": self.pausa_uso_var.get(),
        }

        try:
            with open(
                self.caminho_config(), "w", encoding="utf-8"
            ) as arquivo:
                json.dump(dados, arquivo, ensure_ascii=False, indent=2)
        except OSError:
            pass

    # ------------------------------------------------------------------
    # Cálculos e validações
    # ------------------------------------------------------------------
    def quantidade_threads(self):
        processadores_logicos = os.cpu_count() or 1
        percentual = PERFIS[self.perfil_var.get()]

        # Sempre usa pelo menos uma thread.
        threads = max(1, int(processadores_logicos * percentual))
        uso_teorico = threads / processadores_logicos * 100

        return threads, processadores_logicos, uso_teorico

    def atualizar_previsao_threads(self):
        threads, processadores_logicos, uso_teorico = (
            self.quantidade_threads()
        )

        self.threads_var.set(
            f"Threads: {threads} de {processadores_logicos} "
            f"(aprox. {uso_teorico:.0f}% da CPU)"
        )

    def atualizar_dica_carteira(self):
        _, descricao = MOEDAS[self.moeda_var.get()]
        self.dica_carteira_var.set(f"Formato esperado: {descricao}")

    def carteira_valida(self, carteira, moeda):
        padrao, _ = MOEDAS[moeda]
        return re.fullmatch(padrao, carteira) is not None

    @staticmethod
    def refcode_valido(refcode):
        return refcode == "" or re.fullmatch(r"[A-Za-z0-9-]{4,12}", refcode)

    @staticmethod
    def nome_worker():
        nome = platform.node() or "MeuNotebook"
        nome = re.sub(r"[^A-Za-z0-9_-]", "-", nome)
        return nome[:32] or "MeuNotebook"

    # ------------------------------------------------------------------
    # Controle do XMRig
    # ------------------------------------------------------------------
    def alternar_mineracao(self):
        if self.processo_minerador is None:
            self.reinicios = 0
            self.iniciar_minerador()
        else:
            self.minerando_desejado = False
            self.parar_minerador()

    def iniciar_minerador(self):
        carteira = self.entrada_carteira.get().strip()
        refcode = self.entrada_refcode.get().strip()
        moeda = self.moeda_var.get().strip().upper()

        if moeda not in MOEDAS:
            messagebox.showerror(
                "Moeda inválida", "Selecione uma moeda da lista."
            )
            return

        if not self.carteira_valida(carteira, moeda):
            _, descricao = MOEDAS[moeda]
            messagebox.showwarning(
                "Carteira inválida",
                "O endereço não corresponde ao formato esperado para "
                f"{moeda}:\n\n{descricao}\n\n"
                "Confira o endereço e a rede de pagamento na unMineable.",
            )
            return

        if not self.refcode_valido(refcode):
            messagebox.showwarning(
                "Código de convite inválido",
                "Use apenas letras, números e hífen (4 a 12 caracteres), "
                "ou deixe em branco.",
            )
            return

        caminho_xmrig = encontrar_xmrig()

        if caminho_xmrig is None:
            nome = "xmrig.exe" if os.name == "nt" else "xmrig"
            abrir = messagebox.askyesno(
                "XMRig não encontrado",
                f"Coloque o arquivo {nome} nesta pasta:\n\n"
                f"{pasta_do_app()}\n\n"
                "Deseja abrir a página oficial de download do XMRig?",
            )
            if abrir:
                webbrowser.open(
                    "https://github.com/xmrig/xmrig/releases/latest"
                )
            return

        self.salvar_config()

        threads, _, _ = self.quantidade_threads()

        usuario_pool = f"{moeda}:{carteira}.{self.nome_worker()}"
        if refcode:
            usuario_pool += f"#{refcode}"

        self.porta_api = porta_livre()

        comando = [
            str(caminho_xmrig),
            "-o", POOL_TLS if self.tls_var.get() else POOL_TCP,
            "-a", "rx",
            "-k",
            "-u", usuario_pool,
            "-p", "x",
            f"--threads={threads}",
            "--cpu-priority=0",
            "--randomx-wrmsr=-1",
            "--donate-level=1",
            "--http-host=127.0.0.1",
            f"--http-port={self.porta_api}",
            "--print-time=10",
            "--no-color",
            "--retries=10",
            "--retry-pause=5",
        ]

        if self.tls_var.get():
            comando.append("--tls")

        if self.pausa_bateria_var.get():
            comando.append("--pause-on-battery")

        if self.pausa_uso_var.get():
            comando.append("--pause-on-active=300")

        pasta = pasta_do_app()

        try:
            caminho_log = pasta / "miner.log"

            self.arquivo_log = open(caminho_log, "a", encoding="utf-8")
            self.arquivo_log.write("\n\n=== Nova sessão de mineração ===\n")
            self.arquivo_log.flush()

            flags = 0

            # Impede a abertura da janela preta do XMRig no Windows.
            if os.name == "nt":
                flags |= subprocess.CREATE_NO_WINDOW

            self.processo_minerador = subprocess.Popen(
                comando,
                cwd=str(pasta),
                stdout=self.arquivo_log,
                stderr=subprocess.STDOUT,
                creationflags=flags,
            )

            self.minerando_desejado = True
            self.inicio_mineracao = time.monotonic()
            self.definir_interface_minerando(True)
            self.status_var.set(f"Status: minerando para receber {moeda}")
            self.hashrate_var.set("Hashrate: iniciando...")
            self.shares_var.set("Shares: aguardando...")

        except Exception as erro:
            self.fechar_log()
            self.processo_minerador = None
            self.minerando_desejado = False

            messagebox.showerror(
                "Erro ao iniciar",
                f"Não foi possível iniciar o XMRig:\n\n{erro}",
            )

    def parar_minerador(self, atualizar_interface=True):
        processo = self.processo_minerador
        self.processo_minerador = None
        self.inicio_mineracao = None

        if processo is not None and processo.poll() is None:
            try:
                processo.terminate()
                processo.wait(timeout=4)

            except subprocess.TimeoutExpired:
                processo.kill()
                processo.wait(timeout=2)

            except Exception:
                pass

        self.fechar_log()

        if atualizar_interface:
            self.definir_interface_minerando(False)
            self.status_var.set("Status: parado")
            self.hashrate_var.set("Hashrate: -- H/s")
            self.shares_var.set("Shares: --")
            self.uptime_var.set("Tempo minerando: --")

    def definir_interface_minerando(self, minerando):
        if minerando:
            self.botao_iniciar.config(
                text="PARAR MINERAÇÃO", bg="#d93025"
            )
            estado_campos = "disabled"
        else:
            self.botao_iniciar.config(
                text="INICIAR MINERAÇÃO", bg="#188038"
            )
            estado_campos = "normal"

        combo = "disabled" if minerando else "readonly"
        self.menu_moedas.config(state=combo)
        self.menu_perfil.config(state=combo)
        self.entrada_carteira.config(state=estado_campos)
        self.entrada_refcode.config(state=estado_campos)
        self.check_tls.config(state=estado_campos)
        self.check_bateria.config(state=estado_campos)
        self.check_uso.config(state=estado_campos)

    # ------------------------------------------------------------------
    # Monitoramento
    # ------------------------------------------------------------------
    def monitorar_processo(self):
        if self.encerrando:
            return

        processo = self.processo_minerador

        if processo is not None:
            codigo_saida = processo.poll()

            if codigo_saida is not None:
                self.processo_minerador = None
                self.fechar_log()
                self.tratar_queda(codigo_saida)

            else:
                self.atualizar_uptime()

                # A consulta é feita fora da thread da interface.
                threading.Thread(
                    target=self.consultar_api_xmrig,
                    daemon=True,
                ).start()

        self.root.after(2000, self.monitorar_processo)

    def tratar_queda(self, codigo_saida):
        """Reinicia o XMRig se ele caiu sem o usuário pedir para parar."""
        if self.minerando_desejado and self.reinicios < MAX_REINICIOS:
            self.reinicios += 1
            self.status_var.set(
                f"Status: XMRig caiu (código {codigo_saida}). "
                f"Reiniciando ({self.reinicios}/{MAX_REINICIOS})..."
            )
            self.root.after(3000, self.iniciar_minerador)
            return

        self.minerando_desejado = False
        self.definir_interface_minerando(False)

        detalhe = self.ultimas_linhas_log()
        mensagem = (
            f"Status: XMRig encerrou com código {codigo_saida}. "
            "Veja miner.log"
        )
        if detalhe:
            mensagem += f"\nÚltimo log: {detalhe}"

        self.status_var.set(mensagem)
        self.hashrate_var.set("Hashrate: -- H/s")
        self.shares_var.set("Shares: --")
        self.uptime_var.set("Tempo minerando: --")

    def ultimas_linhas_log(self):
        """Retorna a última linha útil do miner.log para diagnóstico."""
        try:
            caminho = pasta_do_app() / "miner.log"
            linhas = caminho.read_text(
                encoding="utf-8", errors="replace"
            ).strip().splitlines()

            for linha in reversed(linhas):
                linha = linha.strip()
                if linha and not linha.startswith("==="):
                    return linha[:160]
        except OSError:
            pass

        return ""

    def atualizar_uptime(self):
        if self.inicio_mineracao is None:
            return

        segundos = int(time.monotonic() - self.inicio_mineracao)
        horas, resto = divmod(segundos, 3600)
        minutos, segundos = divmod(resto, 60)

        self.uptime_var.set(
            f"Tempo minerando: {horas:02d}:{minutos:02d}:{segundos:02d}"
        )

    def consultar_api_xmrig(self):
        if self.porta_api is None:
            return

        url = f"http://127.0.0.1:{self.porta_api}/2/summary"

        try:
            with urllib.request.urlopen(url, timeout=0.8) as resposta:
                dados = json.load(resposta)

            valores_hashrate = dados.get("hashrate", {}).get("total", [])

            hashrate = next(
                (
                    valor
                    for valor in valores_hashrate
                    if isinstance(valor, (int, float))
                ),
                0,
            )

            resultados = dados.get("results", {})
            shares_boas = resultados.get("shares_good", 0)
            shares_total = resultados.get("shares_total", 0)

            self.root.after(
                0,
                lambda: self.mostrar_estatisticas(
                    float(hashrate),
                    int(shares_boas),
                    int(shares_total),
                ),
            )

        except Exception:
            # Nos primeiros segundos, a API ainda pode não estar pronta.
            pass

    def mostrar_estatisticas(self, hashrate, shares_boas, shares_total):
        if self.processo_minerador is None:
            return

        self.hashrate_var.set(f"Hashrate: {hashrate:,.1f} H/s")

        rejeitadas = max(0, shares_total - shares_boas)
        self.shares_var.set(
            f"Shares: {shares_boas} aceitas / {rejeitadas} rejeitadas"
        )

    # ------------------------------------------------------------------
    # Utilidades
    # ------------------------------------------------------------------
    def abrir_pagina_saldo(self):
        carteira = self.entrada_carteira.get().strip()
        moeda = self.moeda_var.get()

        if not carteira:
            messagebox.showinfo(
                "Carteira vazia",
                "Preencha o endereço da carteira para consultar o saldo.",
            )
            return

        webbrowser.open(
            f"https://unmineable.com/coins/{moeda}/address/{carteira}"
        )

    def fechar_log(self):
        if self.arquivo_log is not None:
            try:
                self.arquivo_log.close()
            except Exception:
                pass

            self.arquivo_log = None

    def fechar_app(self):
        self.encerrando = True
        self.minerando_desejado = False
        self.salvar_config()
        self.parar_minerador(atualizar_interface=False)
        self.root.destroy()


if __name__ == "__main__":
    root = tk.Tk()
    app = MineradorApp(root)
    root.mainloop()
