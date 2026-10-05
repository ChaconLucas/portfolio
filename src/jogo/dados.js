/**
 * Dados do jogo: a mesma stack da secao Stack do site (stackData no
 * index.html, com nivel e descricao de cada tecnologia e onde a area foi
 * usada) e o mapa tecnologia -> projetos do Stack Universe (projectsByTech).
 * Gerado a partir do index.html; se a stack mudar la, regerar aqui.
 */
export const STACK = {
 "frontend": {
  "titulo": "Frontend",
  "desc": "Interfaces responsivas, componentes, estados, formulários, consumo de APIs, boas práticas de UI e experiência de produto.",
  "usado": "GateCheck · WSL · Rare7 · Tiixokê",
  "techs": [
   {
    "nome": "HTML5",
    "nivel": "Core",
    "desc": "Estrutura semântica e acessível"
   },
   {
    "nome": "CSS3",
    "nivel": "Core",
    "desc": "Layout, responsividade e animações"
   },
   {
    "nome": "JavaScript",
    "nivel": "Core",
    "desc": "DOM, lógica e browser APIs"
   },
   {
    "nome": "TypeScript",
    "nivel": "Primary",
    "desc": "Tipos, contratos e refactors"
   },
   {
    "nome": "React",
    "nivel": "Primary",
    "desc": "Arquitetura de componentes e estado"
   },
   {
    "nome": "Next.js",
    "nivel": "Primary",
    "desc": "Routing, SSR/CSR e aplicações modernas"
   },
   {
    "nome": "Tailwind CSS",
    "nivel": "Regular",
    "desc": "Design systems e velocidade de UI"
   },
   {
    "nome": "Bootstrap",
    "nivel": "Regular",
    "desc": "Componentização e grids"
   }
  ]
 },
 "backend": {
  "titulo": "Backend",
  "desc": "Construção de APIs, regras de negócio, autenticação, integração de serviços e organização de código em camadas.",
  "usado": "GateCheck · Rare7 · D&Z · Factory",
  "techs": [
   {
    "nome": "Python",
    "nivel": "Primary",
    "desc": "APIs, automação e lógica de negócio"
   },
   {
    "nome": "FastAPI",
    "nivel": "Primary",
    "desc": "REST APIs, validação e serviços"
   },
   {
    "nome": "PHP",
    "nivel": "Professional",
    "desc": "Sistemas web e e-commerce"
   },
   {
    "nome": "Node.js",
    "nivel": "Working",
    "desc": "Serviços e APIs complementares"
   },
   {
    "nome": "Express",
    "nivel": "Working",
    "desc": "Camada HTTP e middlewares"
   },
   {
    "nome": "Pydantic",
    "nivel": "Regular",
    "desc": "Validação e contratos de dados"
   },
   {
    "nome": "JWT",
    "nivel": "Regular",
    "desc": "Auth baseada em token"
   },
   {
    "nome": "bcrypt",
    "nivel": "Regular",
    "desc": "Hash seguro de senhas"
   }
  ]
 },
 "mobile": {
  "titulo": "Mobile",
  "desc": "Apps cross-platform com navegação, formulários, estado global e persistência local.",
  "usado": "FLASH · Gestão Mobile · Experimentos React Native",
  "techs": [
   {
    "nome": "React Native",
    "nivel": "Primary",
    "desc": "UI mobile cross-platform"
   },
   {
    "nome": "Expo",
    "nivel": "Primary",
    "desc": "Tooling e build mobile"
   },
   {
    "nome": "Expo Router",
    "nivel": "Regular",
    "desc": "Navegação baseada em arquivos"
   },
   {
    "nome": "Redux Toolkit",
    "nivel": "Regular",
    "desc": "Estado global"
   },
   {
    "nome": "SQLite",
    "nivel": "Regular",
    "desc": "Persistência local"
   },
   {
    "nome": "Drizzle ORM",
    "nivel": "Regular",
    "desc": "Acesso tipado ao banco local"
   },
   {
    "nome": "AsyncStorage",
    "nivel": "Regular",
    "desc": "Persistência leve"
   },
   {
    "nome": "Responsive UI",
    "nivel": "Core",
    "desc": "Adaptação para diferentes telas"
   }
  ]
 },
 "data": {
  "titulo": "Data",
  "desc": "Modelagem relacional, consultas SQL, ORMs, migrations e consistência entre domínio e banco.",
  "usado": "GateCheck · Rare7 · Factory · Mobile",
  "techs": [
   {
    "nome": "PostgreSQL",
    "nivel": "Primary",
    "desc": "Banco relacional para produção"
   },
   {
    "nome": "MySQL",
    "nivel": "Professional",
    "desc": "E-commerce e admin systems"
   },
   {
    "nome": "SQLite",
    "nivel": "Regular",
    "desc": "Persistência local/mobile"
   },
   {
    "nome": "SQL",
    "nivel": "Core",
    "desc": "Consultas, joins e filtros"
   },
   {
    "nome": "SQLAlchemy",
    "nivel": "Primary",
    "desc": "ORM e persistência"
   },
   {
    "nome": "Alembic",
    "nivel": "Regular",
    "desc": "Migrations em Python"
   },
   {
    "nome": "Drizzle ORM",
    "nivel": "Regular",
    "desc": "Camada tipada"
   },
   {
    "nome": "Schema design",
    "nivel": "Core",
    "desc": "Relacionamentos e integridade"
   }
  ]
 },
 "security": {
  "titulo": "Security",
  "desc": "Aplicação de autenticação, autorização, validação, auditoria e visão de desenvolvimento seguro.",
  "usado": "GateCheck · D&Z systems",
  "techs": [
   {
    "nome": "JWT",
    "nivel": "Primary",
    "desc": "Access e refresh token flows"
   },
   {
    "nome": "bcrypt",
    "nivel": "Regular",
    "desc": "Hash de senhas"
   },
   {
    "nome": "RBAC",
    "nivel": "Regular",
    "desc": "Controle de acesso por papéis"
   },
   {
    "nome": "Audit Logs",
    "nivel": "Primary",
    "desc": "Rastreabilidade e auditoria"
   },
   {
    "nome": "Validation",
    "nivel": "Core",
    "desc": "Sanitização e validação"
   },
   {
    "nome": "Kali Linux",
    "nivel": "Study",
    "desc": "Ambiente de segurança"
   },
   {
    "nome": "Pentest",
    "nivel": "Study",
    "desc": "Recon, enumeração e análise"
   },
   {
    "nome": "Secure Dev",
    "nivel": "Core",
    "desc": "Mentalidade secure by design"
   }
  ]
 },
 "infra": {
  "titulo": "Infra / Deploy",
  "desc": "Versionamento, pipelines simples, deploy e publicação de aplicações.",
  "usado": "Projetos web atuais",
  "techs": [
   {
    "nome": "Git",
    "nivel": "Daily",
    "desc": "Versionamento e branches"
   },
   {
    "nome": "GitHub",
    "nivel": "Daily",
    "desc": "Repos, PRs e colaboração"
   },
   {
    "nome": "GitHub Actions",
    "nivel": "Regular",
    "desc": "Automação e CI"
   },
   {
    "nome": "Vercel",
    "nivel": "Regular",
    "desc": "Deploy de frontend"
   },
   {
    "nome": "Render",
    "nivel": "Regular",
    "desc": "Deploy de APIs e serviços"
   },
   {
    "nome": "Environment Vars",
    "nivel": "Core",
    "desc": "Configuração segura"
   },
   {
    "nome": "REST APIs",
    "nivel": "Core",
    "desc": "Integrações entre serviços"
   },
   {
    "nome": "Webhooks",
    "nivel": "Working",
    "desc": "Integrações e eventos"
   }
  ]
 },
 "tooling": {
  "titulo": "Tooling",
  "desc": "Ferramentas de desenvolvimento usadas no dia a dia para produtividade, debug e organização.",
  "usado": "Workflow de desenvolvimento diário",
  "techs": [
   {
    "nome": "VS Code",
    "nivel": "Daily",
    "desc": "Editor principal"
   },
   {
    "nome": "Terminal",
    "nivel": "Daily",
    "desc": "CLI-first workflow"
   },
   {
    "nome": "PyCharm",
    "nivel": "Regular",
    "desc": "Projetos Python"
   },
   {
    "nome": "MySQL Workbench",
    "nivel": "Regular",
    "desc": "Banco e consultas"
   },
   {
    "nome": "Postman",
    "nivel": "Regular",
    "desc": "Testes de API"
   },
   {
    "nome": "Insomnia",
    "nivel": "Regular",
    "desc": "Exploração de APIs"
   },
   {
    "nome": "npm",
    "nivel": "Daily",
    "desc": "Gerenciamento de pacotes"
   },
   {
    "nome": "pnpm",
    "nivel": "Working",
    "desc": "Fluxos alternativos"
   }
  ]
 },
 "analytics": {
  "titulo": "Analytics",
  "desc": "Manipulação de dados, análise, relatórios e visualização para projetos e estudos.",
  "usado": "Projetos acadêmicos e análises",
  "techs": [
   {
    "nome": "Pandas",
    "nivel": "Regular",
    "desc": "Tratamento e análise de dados"
   },
   {
    "nome": "Power BI",
    "nivel": "Regular",
    "desc": "Dashboards e relatórios"
   },
   {
    "nome": "CSV",
    "nivel": "Core",
    "desc": "Importação e tratamento"
   },
   {
    "nome": "Data Cleaning",
    "nivel": "Core",
    "desc": "Padronização e consistência"
   },
   {
    "nome": "Excel",
    "nivel": "Regular",
    "desc": "Apoio analítico"
   },
   {
    "nome": "KPIs",
    "nivel": "Core",
    "desc": "Indicadores e acompanhamento"
   },
   {
    "nome": "Dashboards",
    "nivel": "Regular",
    "desc": "Leitura visual de dados"
   },
   {
    "nome": "Reports",
    "nivel": "Regular",
    "desc": "Saídas analíticas"
   }
  ]
 },
 "ai": {
  "titulo": "AI Workflow",
  "desc": "Uso de IA como acelerador de desenvolvimento, documentação, pesquisa, implementação e revisão.",
  "usado": "Workflow de desenvolvimento atual",
  "techs": [
   {
    "nome": "Claude Code",
    "nivel": "Daily",
    "desc": "Terminal coding workflow"
   },
   {
    "nome": "OpenAI Codex",
    "nivel": "Daily",
    "desc": "Implementação e revisão"
   },
   {
    "nome": "GitHub Copilot",
    "nivel": "Regular",
    "desc": "Assistência dentro do editor"
   },
   {
    "nome": "Prompting",
    "nivel": "Daily",
    "desc": "Estruturação de tarefas técnicas"
   },
   {
    "nome": "Docs with AI",
    "nivel": "Regular",
    "desc": "Documentação e apoio"
   },
   {
    "nome": "Code Review",
    "nivel": "Regular",
    "desc": "Iteração e melhoria"
   },
   {
    "nome": "VS Code",
    "nivel": "Daily",
    "desc": "Ambiente de uso com IA"
   },
   {
    "nome": "Human-in-the-loop",
    "nivel": "Core",
    "desc": "Decisão humana com execução assistida"
   }
  ]
 }
};

export const PROJETOS_POR_TECH = {"FastAPI": ["GateCheck"], "React": ["GateCheck", "WSL SporTV Games", "Rare7"], "Next.js": ["GateCheck", "Rare7"], "Python": ["GateCheck", "WSL SporTV Games"], "PostgreSQL": ["GateCheck"], "MySQL": ["WSL SporTV Games"], "TypeScript": ["GateCheck", "Rare7"], "JWT": ["GateCheck"], "Claude Code": ["GateCheck", "Portfólio"], "OpenAI Codex": ["GateCheck", "Portfólio"]};

// ancora de cada projeto no site (para o link "ver projeto")
export const ANCORA = { 'GateCheck': '#project-gatecheck', 'WSL SporTV Games': '#project-wsl', 'WSL': '#project-wsl', 'Rare7': '#project-rare7', 'FLASH': '#project-flash' };
