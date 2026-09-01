# Modelos 3D

## bryce.glb
Personagem "Bryce" com a animacao "Typing", de Mixamo (Adobe).
Uso permitido em projetos pelos termos do Mixamo. O arquivo aqui e uma versao
processada, nao o original: FBX -> glTF, textura reduzida para 1024 em WebP e
malha em meshopt.

49,9 MB -> 1,3 MB.

### Para reprocessar
NAO use `gltf-transform optimize`: os passos `join` e `flatten` colapsam os nos
que o skin referencia, o esqueleto cai de 109 para 8 ossos e o boneco derrete.
A sequencia que preserva o rig:

    FBX2glTF -i entrada.fbx -o bruto --binary
    gltf-transform resize bruto.glb r.glb --width 1024 --height 1024
    gltf-transform webp   r.glb     w.glb
    gltf-transform meshopt w.glb    bryce.glb

O carregador precisa do `MeshoptDecoder`, senao o arquivo falha em silencio.

## anim-texting.glb
Animacao "Texting" do Mixamo, para o capitulo do FLASH (mobile).

**So o esqueleto e a animacao.** O arquivo original veio com skin: 52,9 MB de FBX,
1,37 MB depois de comprimido — e essa malha e a MESMA de `bryce.glb`, ou seja,
seria o personagem inteiro baixado duas vezes.

Removendo malhas, skins, materiais e texturas e mantendo apenas os nos dos ossos
e as trilhas de animacao, sobram **84 KB**. O clipe e aplicado por cima do
modelo que ja esta carregado, porque os nomes dos ossos do Mixamo sao iguais
entre personagens.

    gltf-transform meshopt entrada.glb saida.glb   # depois de remover as malhas

Sem esse passo, cada animacao nova custaria 1,4 MB em vez de 84 KB.
