import 'package:flutter/material.dart';
import 'core/palette.dart';
import 'features/room/room_screen.dart';

class DenApp extends StatelessWidget {
  const DenApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Den',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: DenPalette.bg,
        colorScheme: const ColorScheme.dark(
          primary: DenPalette.accent,
          surface: DenPalette.surface,
          onSurface: DenPalette.text,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: DenPalette.surfaceAlt,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(24),
            borderSide: BorderSide.none,
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        ),
      ),
      // Demo: drop straight into a room. Real app routes through auth -> friends list -> room.
      home: const RoomScreen(roomOwnerId: 'demo_friend', myUserId: 'me'),
    );
  }
}
