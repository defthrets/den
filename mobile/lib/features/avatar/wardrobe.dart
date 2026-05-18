/// Catalogue of Retro-Diffusion-generated avatar presets. Each preset
/// corresponds to a 160×128 sprite sheet stored at
/// `assets/sprites/<id>.png` (5 cols × 4 rows × 32px). Mirrored exactly
/// in preview/renderer.js (window.den.presets).
class AvatarPreset {
  final String id;
  final String name;
  const AvatarPreset({required this.id, required this.name});
}

class Wardrobe {
  static const List<AvatarPreset> presets = [
    AvatarPreset(id: 'casual_blue',   name: 'Casual'),
    AvatarPreset(id: 'tank_redhead',  name: 'Tank'),
    AvatarPreset(id: 'punk_purple',   name: 'Punk'),
    AvatarPreset(id: 'summer_yellow', name: 'Summer'),
  ];
}
