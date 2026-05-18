import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import '../../core/palette.dart';
import '../room/components/avatar_component.dart';
import 'wardrobe.dart';

enum _Tab { hair, skin, shirt, pants }

/// Avatar customiser, presented as a full-height bottom sheet.
/// Live preview at the top updates as the user picks styles + colours.
/// Calls [onSave] with the new config when Save is tapped.
class CustomiserSheet extends StatefulWidget {
  final AvatarConfig initial;
  final void Function(AvatarConfig) onSave;

  const CustomiserSheet({super.key, required this.initial, required this.onSave});

  @override
  State<CustomiserSheet> createState() => _CustomiserSheetState();
}

class _CustomiserSheetState extends State<CustomiserSheet> {
  late AvatarConfig _draft = widget.initial;
  _Tab _tab = _Tab.hair;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: DenPalette.bg,
      child: SafeArea(
        child: Column(
          children: [
            _header(),
            _preview(),
            _tabs(),
            Expanded(child: _content()),
          ],
        ),
      ),
    );
  }

  // ── Header ───────────────────────────────────────────────────────────
  Widget _header() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: DenPalette.border)),
        ),
        child: Row(
          children: [
            GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              child: Container(
                width: 36, height: 36,
                decoration: const BoxDecoration(
                  color: DenPalette.surfaceAlt,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.close_rounded,
                    size: 18, color: DenPalette.text),
              ),
            ),
            const SizedBox(width: 12),
            const Text('My avatar',
                style: TextStyle(
                    color: DenPalette.text,
                    fontSize: 16,
                    fontWeight: FontWeight.w600)),
            const Spacer(),
            GestureDetector(
              onTap: () {
                widget.onSave(_draft);
                Navigator.of(context).pop();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
                decoration: BoxDecoration(
                  color: DenPalette.accent,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Text('Save',
                    style: TextStyle(
                        color: Colors.black,
                        fontWeight: FontWeight.w700,
                        fontSize: 13)),
              ),
            ),
          ],
        ),
      );

  // ── Preview stage ────────────────────────────────────────────────────
  Widget _preview() => Container(
        height: 220,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter, end: Alignment.bottomCenter,
            colors: [Color(0xFF20324A), Color(0xFF18223A)],
          ),
        ),
        alignment: Alignment.center,
        child: SizedBox(
          width: 160, height: 200,
          child: AvatarPreview(config: _draft),
        ),
      );

  // ── Tabs ─────────────────────────────────────────────────────────────
  Widget _tabs() => Container(
        color: DenPalette.surface,
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: DenPalette.border)),
        ),
        child: Row(
          children: _Tab.values.map((t) {
            final active = t == _tab;
            return Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _tab = t),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    border: Border(
                      bottom: BorderSide(
                        color: active ? DenPalette.accent : Colors.transparent,
                        width: 2,
                      ),
                    ),
                  ),
                  child: Text(
                    _labelFor(t),
                    style: TextStyle(
                      color: active ? DenPalette.accent : DenPalette.textMuted,
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      );

  String _labelFor(_Tab t) {
    switch (t) {
      case _Tab.hair:  return 'Hair';
      case _Tab.skin:  return 'Skin';
      case _Tab.shirt: return 'Shirt';
      case _Tab.pants: return 'Pants';
    }
  }

  // ── Tab content ──────────────────────────────────────────────────────
  Widget _content() {
    final children = <Widget>[];
    void section(String label, Widget row) {
      children.add(Padding(
        padding: const EdgeInsets.only(top: 14, bottom: 6),
        child: Text(label,
            style: const TextStyle(
                color: DenPalette.textMuted,
                fontSize: 11,
                letterSpacing: 1.2,
                fontWeight: FontWeight.w600)),
      ));
      children.add(row);
    }

    switch (_tab) {
      case _Tab.hair:
        section('HAIR STYLE', _styleRow('hair', Wardrobe.hair));
        section('COLOR',      _colorRow(Wardrobe.hairColors, _draft.hair,
            (c) => _set(_draft.copyWith(hair: c))));
        break;
      case _Tab.skin:
        section('SKIN TONE', _colorRow(Wardrobe.skinTones, _draft.skin,
            (c) => _set(_draft.copyWith(skin: c))));
        break;
      case _Tab.shirt:
        section('SHIRT STYLE', _styleRow('shirt', Wardrobe.shirt));
        section('COLOR',       _colorRow(Wardrobe.shirtColors, _draft.shirt,
            (c) => _set(_draft.copyWith(shirt: c))));
        break;
      case _Tab.pants:
        section('PANTS STYLE', _styleRow('pants', Wardrobe.pants));
        section('COLOR',       _colorRow(Wardrobe.pantsColors, _draft.pants,
            (c) => _set(_draft.copyWith(pants: c))));
        break;
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 32),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
    );
  }

  void _set(AvatarConfig next) => setState(() => _draft = next);

  Widget _styleRow(String slot, List<StyleOption> options) => Wrap(
        spacing: 8, runSpacing: 8,
        children: options.map((o) {
          final active = _selectedStyleId(slot) == o.id;
          return GestureDetector(
            onTap: () {
              switch (slot) {
                case 'hair':
                  _set(_draft.copyWith(hairStyle: o.id));
                  break;
                case 'shirt':
                  _set(_draft.copyWith(shirtStyle: o.id));
                  break;
                case 'pants':
                  _set(_draft.copyWith(pantsStyle: o.id));
                  break;
              }
            },
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: DenPalette.surfaceAlt,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: active ? DenPalette.accent : DenPalette.border,
                  width: active ? 1.5 : 1,
                ),
              ),
              child: Column(
                children: [
                  SizedBox(
                    width: 48, height: 84,
                    child: AvatarPreview(config: _draftForSlotPreview(slot, o.id)),
                  ),
                  const SizedBox(height: 4),
                  Text(o.name,
                      style: const TextStyle(
                          color: DenPalette.text,
                          fontSize: 11,
                          fontWeight: FontWeight.w500)),
                ],
              ),
            ),
          );
        }).toList(),
      );

  int _selectedStyleId(String slot) {
    switch (slot) {
      case 'hair':  return _draft.hairStyle;
      case 'shirt': return _draft.shirtStyle;
      case 'pants': return _draft.pantsStyle;
      default: return 0;
    }
  }

  AvatarConfig _draftForSlotPreview(String slot, int id) {
    switch (slot) {
      case 'hair':  return _draft.copyWith(hairStyle: id);
      case 'shirt': return _draft.copyWith(shirtStyle: id);
      case 'pants': return _draft.copyWith(pantsStyle: id);
      default: return _draft;
    }
  }

  Widget _colorRow(List<Color> palette, Color selected, void Function(Color) onPick) =>
      Wrap(
        spacing: 10, runSpacing: 10,
        children: palette.map((c) {
          final active = c.value == selected.value;
          return GestureDetector(
            onTap: () => onPick(c),
            child: Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: c,
                shape: BoxShape.circle,
                border: Border.all(
                  color: active ? DenPalette.accent : DenPalette.border,
                  width: active ? 2 : 1.5,
                ),
                boxShadow: active
                    ? [BoxShadow(color: DenPalette.accent.withOpacity(0.4), blurRadius: 6)]
                    : null,
              ),
            ),
          );
        }).toList(),
      );
}

/// Stateless widget that renders a single avatar configuration as a
/// scaled-up pixel-art preview. Used in the customiser preview stage
/// and in the style chips.
class AvatarPreview extends StatefulWidget {
  final AvatarConfig config;
  const AvatarPreview({super.key, required this.config});

  @override
  State<AvatarPreview> createState() => _AvatarPreviewState();
}

class _AvatarPreviewState extends State<AvatarPreview> {
  ui.Image? _img;
  AvatarConfig? _builtFor;

  @override
  void initState() {
    super.initState();
    _rebuild();
  }

  @override
  void didUpdateWidget(AvatarPreview old) {
    super.didUpdateWidget(old);
    if (_builtFor != widget.config) _rebuild();
  }

  Future<void> _rebuild() async {
    final cfg = widget.config;
    final img = await buildAvatarSprite(cfg);
    if (!mounted) return;
    setState(() {
      _img = img;
      _builtFor = cfg;
    });
  }

  @override
  Widget build(BuildContext context) {
    final img = _img;
    if (img == null) return const SizedBox.shrink();
    return LayoutBuilder(
      builder: (_, c) => CustomPaint(
        size: Size(c.maxWidth, c.maxHeight),
        painter: _PixelPainter(img),
      ),
    );
  }
}

class _PixelPainter extends CustomPainter {
  final ui.Image image;
  _PixelPainter(this.image);

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawImageRect(
      image,
      Rect.fromLTWH(0, 0, image.width.toDouble(), image.height.toDouble()),
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..filterQuality = FilterQuality.none,
    );
  }

  @override
  bool shouldRepaint(covariant _PixelPainter old) => old.image != image;
}
