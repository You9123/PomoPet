-- GENERADO por `npm run sprites:variantes` (frontend/tools/variantes.mjs). No editar a mano.
-- Colores disponibles de cada especie; `codigo` es la carpeta de imágenes en el frontend.
INSERT INTO variantes_mascota (especie_id, codigo, nombre, muestra, orden)
SELECT e.id, v.codigo, v.nombre, v.muestra, v.orden
FROM (VALUES
    ('gato', 'clasico', 'Clásico', '#ff9a3c', 1),
    ('gato', 'ceniza', 'Ceniza', '#a79d94', 2),
    ('gato', 'sombra', 'Sombra', '#5b4e43', 3),
    ('gato', 'nieve', 'Nieve', '#dcd3ca', 4),
    ('gato', 'rosa', 'Rosa', '#fb559d', 5),
    ('gato', 'celeste', 'Celeste', '#46bef5', 6),
    ('perro', 'clasico', 'Clásico', '#c98f5a', 1),
    ('perro', 'ceniza', 'Ceniza', '#97918c', 2),
    ('perro', 'sombra', 'Sombra', '#4e4943', 3),
    ('perro', 'nieve', 'Nieve', '#d3cec9', 4),
    ('perro', 'dorado', 'Dorado', '#cdb465', 5),
    ('perro', 'celeste', 'Celeste', '#60a3c3', 6),
    ('dragon', 'clasico', 'Clásico', '#3ecf6e', 1),
    ('dragon', 'fuego', 'Fuego', '#cf4c3e', 2),
    ('dragon', 'hielo', 'Hielo', '#58b3c9', 3),
    ('dragon', 'violeta', 'Violeta', '#8645c8', 4),
    ('dragon', 'sombra', 'Sombra', '#3d4941', 5),
    ('dragon', 'nieve', 'Nieve', '#c2cfc7', 6)
) AS v(especie, codigo, nombre, muestra, orden)
JOIN especies_mascota e ON e.codigo = v.especie;
