import 'package:flutter/material.dart';

abstract final class DenPalette {
  // App chrome
  static const Color bg = Color(0xFF0D1117);
  static const Color surface = Color(0xFF161B22);
  static const Color surfaceAlt = Color(0xFF21262D);
  static const Color border = Color(0xFF30363D);
  static const Color accent = Color(0xFFF5A623);
  static const Color accentDim = Color(0xFF7D5213);
  static const Color text = Color(0xFFE6EDF3);
  static const Color textMuted = Color(0xFF8B949E);

  // Room background (Habbo sky gradient)
  static const Color skyTop = Color(0xFF1A2744);
  static const Color skyBottom = Color(0xFF2D4A7A);

  // Isometric floor tiles — classic warm stone
  static const Color floorTopA = Color(0xFFC8B99A); // light squares
  static const Color floorTopB = Color(0xFFB5A688); // dark squares (checkerboard)
  static const Color floorLeftFace = Color(0xFF8A7A60);
  static const Color floorRightFace = Color(0xFF9E8D70);
  static const Color floorOutline = Color(0xFF6E5E48);

  // Wall (back panel)
  static const Color wallFaceLight = Color(0xFFDDD0BA);
  static const Color wallFaceDark = Color(0xFFC4B49E);
  static const Color wallOutline = Color(0xFF9A8870);

  // Avatar defaults (overridden by customisation)
  static const Color skinA = Color(0xFFFFCC99);
  static const Color skinB = Color(0xFFE8A87C);
  static const Color hairBrown = Color(0xFF4A3728);
  static const Color shirtBlue = Color(0xFF4488CC);
  static const Color shirtRed = Color(0xFFCC4444);
  static const Color pantsNavy = Color(0xFF2244AA);

  // Chat bubbles
  static const Color bubbleMe = Color(0xFF1F3A5F);
  static const Color bubbleThem = Color(0xFF21262D);
  static const Color bubbleTextMe = Color(0xFFE6EDF3);
  static const Color bubbleTextThem = Color(0xFFE6EDF3);
}
