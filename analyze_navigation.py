import re
import json

# Read HTML file
with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# App structure
navigation = {
    "screens": {},
    "buttons": []
}

# Find all screens (main-content div)
screens = re.findall(r'<div id="([^"]+)" class="[^"]*main-content', content)
print("Found screens:")
for screen in screens:
    navigation["screens"][screen] = {"name": screen, "buttons": []}
    print(f"  - {screen}")

print(f"\nTotal screens: {len(screens)}")

# Find buttons with onclick
onclick_pattern = r'onclick=["\']window\.App\.(\w+)\(([^)]*)\)["\']'
buttons = re.findall(onclick_pattern, content)

print(f"\nFound {len(buttons)} buttons with onclick")
print("\nTop 30 functions:")
unique_functions = {}
for func, params in buttons:
    if func not in unique_functions:
        unique_functions[func] = []
    unique_functions[func].append(params)

for func, params_list in sorted(unique_functions.items(), key=lambda x: -len(x[1]))[:30]:
    print(f"  {func}() - calls: {len(params_list)}")

print(f"\n\nTotal unique functions: {len(unique_functions)}")

# Create Mermaid diagram
print("\n\n=== MERMAID DIAGRAM ===\n")
print("```mermaid")
print("graph TD")
print("    Start[App Start]")
print("    Start --> HomeScreen[Home Screen]")
print("")
print("    %% Main Navigation")
print("    HomeScreen --> |Vse Temy| TopicSelection[Topic Selection]")
print("    HomeScreen --> |V Uchebe| AllSetsScreen[All Sets Screen]")
print("    HomeScreen --> |Podnabory za nedelyu| WeekContent[Week Content]")
print("")
print("    %% Topic Flow")
print("    TopicSelection --> |Select Topic| TopicWords[Topic Words List]")
print("    TopicWords --> |Click Word| WordDetail[Word Detail Screen]")
print("    TopicWords --> |Uprazhneniya| ExerciseType[Exercise Type Selection]")
print("    WordDetail --> |Uchit| AllSetsScreen")
print("")
print("    %% Exercise Flow")
print("    ExerciseType --> |Gap Fill| GapFillEx[Gap Fill Exercise]")
print("    ExerciseType --> |Article| ArticleEx[Article Exercise]")
print("    ExerciseType --> |Audio| AudioEx[Audio Exercise]")
print("    ExerciseType --> |Image| ImageEx[Image Match Exercise]")
print("    ExerciseType --> |Word Building| BuildEx[Word Building Exercise]")
print("")
print("    %% Study Flow")
print("    AllSetsScreen --> |K Povtoru| DirectionModal{Select Direction}")
print("    AllSetsScreen --> |Praktika| DirectionModal")
print("    DirectionModal --> |RU->DE| StudyScreen[Study Screen Cards]")
print("    DirectionModal --> |DE->RU| StudyScreen")
print("    StudyScreen --> |Finish| AllSetsScreen")
print("")
print("    %% Week Content")
print("    WeekContent --> |Karusel| CarouselScreen[Carousel Screen]")
print("    WeekContent --> |Mantry| MantraModal[Mantra Modal]")
print("    WeekContent --> |Video| VideoScreen[Video Content]")
print("    WeekContent --> |Istoriya| StoryScreen[Story Content]")
print("")
print("    %% Bottom Navigation")
print("    BottomNav[Bottom Navigation Bar]")
print("    BottomNav --> |Glavnaya| HomeScreen")
print("    BottomNav --> |V Uchebe| AllSetsScreen")
print("    BottomNav --> |Vse Temy| TopicSelection")
print("```")

# Save to file
with open('app_structure.json', 'w', encoding='utf-8') as f:
    json.dump({
        "screens": list(screens),
        "functions": {k: len(v) for k, v in unique_functions.items()},
        "total_buttons": len(buttons)
    }, f, indent=2, ensure_ascii=False)

print("\n\nSaved structure to app_structure.json")
