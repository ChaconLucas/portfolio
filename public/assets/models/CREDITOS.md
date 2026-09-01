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
