import csv
import json

# Читаем CSV
with open('Export Words1 - Слова (копия).csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    words = []
    
    for row in reader:
        # Определяем часть речи
        pos = row['partOfSpeech']
        if 'сущ' in pos:
            part_of_speech = 'noun'
        elif 'глагол' in pos:
            part_of_speech = 'verb'
        elif 'прил' in pos:
            part_of_speech = 'adjective'
        else:
            part_of_speech = pos
        
        # Маппинг топиков
        topic_mapping = {
            'relationships & communication': 'social_relations',
            'house & dwelling': 'home',
            'work & career': 'work'
        }
        
        topics_raw = [t.strip() for t in row['topics'].split(',')] if row['topics'] else []
        topics = [topic_mapping.get(t, t) for t in topics_raw]
        
        # Обработка image - использовать filename из CSV или placeholder
        image_value = row['image'] if row['image'] and row['image'] != '—' else f"https://placehold.co/400x200?text={row['word']}"
        # Если это просто имя файла (не URL), добавить путь
        if image_value and not image_value.startswith('http'):
            image_value = f"/images/{image_value}"
        
        word_obj = {
            'id': row['id'],
            'word': row['word'],
            'article': row['article'] if row['article'] and row['article'] != '—' else None,
            'gender': row['gender'] if row['gender'] and row['gender'] != '—' else None,
            'partOfSpeech': part_of_speech,
            'translation': [row['translation']] if row['translation'] else [],
            'transcription': '',
            'transcriptionRu': row['transcriptionRu'] if row['transcriptionRu'] else '',
            'plural': row['plural'] if row['plural'] and row['plural'] != '—' else None,
            'examples': [row['examples']] if row['examples'] else [],
            'association': row['association'] if row['association'] else '',
            'image': image_value,
            'topics': topics,
            'level': row['level'] if row['level'] else 'A1',
            'forms': [f.strip() for f in row['forms'].split(';')] if row['forms'] and row['forms'] != '—' else None,
            'conjugation': None
        }
        
        # Обработка conjugation
        if row['conjugation'] and row['conjugation'] != '—':
            conj_text = row['conjugation'].replace('…', '').strip()
            if conj_text:
                conj_parts = [c.strip() for c in conj_text.split(';')]
                if len(conj_parts) >= 6:
                    word_obj['conjugation'] = {
                        'ich': conj_parts[0].split()[-1] if ' ' in conj_parts[0] else conj_parts[0],
                        'du': conj_parts[1].split()[-1] if ' ' in conj_parts[1] else conj_parts[1],
                        'er_sie_es': conj_parts[2].split()[-1] if ' ' in conj_parts[2] else conj_parts[2],
                        'wir': conj_parts[3].split()[-1] if ' ' in conj_parts[3] else conj_parts[3],
                        'ihr': conj_parts[4].split()[-1] if ' ' in conj_parts[4] else conj_parts[4],
                        'sie_Sie': conj_parts[5].split()[-1] if ' ' in conj_parts[5] else conj_parts[5]
                    }
        
        words.append(word_obj)

# Записываем JSON
with open('words.json', 'w', encoding='utf-8') as f:
    json.dump(words, f, ensure_ascii=False, indent=2)

print(f'✓ Создано {len(words)} слов в words.json')
