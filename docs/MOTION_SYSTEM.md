# MOTION SYSTEM

## Princípio
Movimento é funcional: cada movimento deve explicar profundidade, mudança de contexto ou progressão. Não usar efeitos apenas decorativos.

## Scroll-scrub
Para cada seção sticky:
```js
progress = clamp((-sectionRect.top) / (sectionHeight - viewportHeight), 0, 1)
```
Suavizar apenas quando necessário:
```js
smooth += (target - smooth) * 0.06
```

## Universe
- Planetas orbitam naturalmente pelo tempo em velocidade baixa.
- Scroll gira **o sistema inteiro lentamente**, cerca de 20–35 graus ao longo da passagem.
- Não acelerar as órbitas com scroll.
- Câmera permanece no enquadramento 3/4; dolly mínimo é aceitável.
- Ao selecionar planeta, raycast + camera focus suave.
- Labels acompanham projeção do planeta.

## Transições
### Hero → Universe
Deve haver overlap. O Universe começa a nascer antes do Hero desaparecer. Nunca mostrar viewport vazia.

### Universe → Experience
Um elemento luminoso do universo pode virar a origem da timeline. Evitar wipe genérico e telas intermediárias.

### Projects
Cada projeto é um capítulo próprio. Screenshots fazem crossfade/parallax com o scroll. A próxima cena deve começar a nascer antes da anterior sumir.

## Proibições
- dead scroll;
- blur acima de ~5px em conteúdo legível;
- elementos gigantes passando por cima da tela como overlay aleatório;
- transform que remove `translate(-50%,-50%)` de elementos centralizados;
- animações CSS autônomas brigando com scroll-scrub.
