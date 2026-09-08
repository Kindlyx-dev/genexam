export interface Chapter {
  id: string
  name: string
  nameHi?: string
  book?: string // e.g. Kritika, Kavya Khand, Prose/Poetry section
}

export interface Subject {
  id: string
  name: string
  nameHi: string
  color: string // tailwind gradient classes
  emoji: string
  code?: string
  chapters: Chapter[]
}

export const SYLLABUS: Subject[] = [
  {
    id: 'english',
    name: 'English',
    nameHi: 'अंग्रेज़ी',
    color: 'from-violet-500 to-fuchsia-500',
    emoji: '📘',
    chapters: [
      { id: 'en-1', name: 'A Letter to God', book: 'Prose' },
      { id: 'en-2', name: 'Nelson Mandela: Long Walk to Freedom', book: 'Prose' },
      { id: 'en-3', name: 'His First Flight', book: 'Prose' },
      { id: 'en-4', name: 'Black Aeroplane', book: 'Prose' },
      { id: 'en-5', name: 'From the Diary of Anne Frank', book: 'Prose' },
      { id: 'en-6', name: 'Glimpses of India', book: 'Prose' },
      { id: 'en-7', name: 'Dust of Snow', book: 'Poetry' },
      { id: 'en-8', name: 'Fire and Ice', book: 'Poetry' },
      { id: 'en-9', name: 'A Tiger in the Zoo', book: 'Poetry' },
      { id: 'en-10', name: 'How to Tell Wild Animals', book: 'Poetry' },
      { id: 'en-11', name: 'The Ball Poem', book: 'Poetry' },
      { id: 'en-12', name: 'Amanda!', book: 'Poetry' },
      { id: 'en-13', name: 'A Triumph of Surgery', book: 'Supplementary' },
      { id: 'en-14', name: "The Thief's Story", book: 'Supplementary' },
      { id: 'en-15', name: 'The Midnight Visitor', book: 'Supplementary' },
      { id: 'en-16', name: 'A Question of Trust', book: 'Supplementary' },
    ],
  },
  {
    id: 'hindi',
    name: 'Hindi',
    nameHi: 'हिंदी',
    color: 'from-amber-500 to-orange-500',
    emoji: '📕',
    chapters: [
      { id: 'hi-1', name: 'सूरदास के पद', nameHi: 'सूरदास', book: 'काव्य खंड' },
      { id: 'hi-2', name: 'राम-लक्ष्मण-परशुराम संवाद', nameHi: 'तुलसीदास', book: 'काव्य खंड' },
      { id: 'hi-3', name: 'नेताजी का चश्मा', nameHi: 'स्वयं प्रकाश', book: 'गद्य खंड' },
      { id: 'hi-4', name: 'बलगोविन भगत', nameHi: 'रामवृक्ष बेनीपुरी', book: 'गद्य खंड' },
      { id: 'hi-5', name: 'माता का आँचल', nameHi: 'शिवराज सिंह चौहान', book: 'कृतिका' },
      { id: 'hi-6', name: 'व्याकरण: मुहावरे, लोकोक्तियाँ, अलंकार (रस), संधि', book: 'व्याकरण' },
    ],
  },
  {
    id: 'maths',
    name: 'Mathematics',
    nameHi: 'गणित',
    color: 'from-blue-500 to-cyan-500',
    emoji: '📐',
    chapters: [
      { id: 'ma-1', name: 'Real Numbers', nameHi: 'वास्तविक संख्याएँ' },
      { id: 'ma-2', name: 'Polynomials', nameHi: 'बहुपद' },
      { id: 'ma-3', name: 'Linear Equations in Two Variables', nameHi: 'दो चरों वाले रैखिक समीकरण' },
      { id: 'ma-4', name: 'Quadratic Equations', nameHi: 'द्विघात समीकरण' },
      { id: 'ma-5', name: 'Arithmetic Progressions', nameHi: 'समांतर श्रेढ़ियाँ' },
      { id: 'ma-6', name: 'Triangles', nameHi: 'त्रिभुज' },
      { id: 'ma-7', name: 'Coordinate Geometry', nameHi: 'निर्देशांक ज्यामिति' },
    ],
  },
  {
    id: 'sst',
    name: 'Social Science',
    nameHi: 'सामाजिक विज्ञान',
    color: 'from-rose-500 to-red-500',
    emoji: '🌍',
    chapters: [
      { id: 'ss-1', name: 'Power Sharing', nameHi: 'सत्ता की साझेदारी', book: 'Political Science' },
      { id: 'ss-2', name: 'Federalism', nameHi: 'संघवाद', book: 'Political Science' },
      { id: 'ss-3', name: 'Development', nameHi: 'विकास', book: 'Economics' },
      { id: 'ss-4', name: 'Sectors of the Indian Economy', nameHi: 'भारतीय अर्थव्यवस्था के क्षेत्रक', book: 'Economics' },
      { id: 'ss-5', name: 'The Rise of Nationalism in Europe', nameHi: 'यूरोप में राष्ट्रवाद का उदय', book: 'History' },
      { id: 'ss-6', name: 'Nationalism in India', nameHi: 'भारत में राष्ट्रवाद', book: 'History' },
      { id: 'ss-7', name: 'Resources and Development', nameHi: 'संसाधन एवं विकास', book: 'Geography' },
      { id: 'ss-8', name: 'Forest and Wildlife Resources', nameHi: 'वन एवं वन्य जीव संसाधन', book: 'Geography' },
      { id: 'ss-9', name: 'Water Resources', nameHi: 'जल संसाधन', book: 'Geography' },
      { id: 'ss-10', name: 'Minerals and Energy Resources', nameHi: 'खनिज तथा ऊर्जा संसाधन', book: 'Geography' },
    ],
  },
  {
    id: 'science',
    name: 'Science',
    nameHi: 'विज्ञान',
    color: 'from-emerald-500 to-teal-500',
    emoji: '🔬',
    chapters: [
      { id: 'sc-1', name: 'Chemical Reactions and Equations', nameHi: 'रासायनिक अभिक्रियाएँ एवं समीकरण' },
      { id: 'sc-2', name: 'Life Processes', nameHi: 'जैव प्रक्रम' },
      { id: 'sc-3', name: 'Control and Coordination', nameHi: 'नियंत्रण एवं समन्वय' },
      { id: 'sc-4', name: 'Human Eye and the Colourful World', nameHi: 'मानव नेत्र तथा रंगबिरंगी दुनिया' },
      { id: 'sc-5', name: 'Our Environment', nameHi: 'हमारा पर्यावरण' },
    ],
  },
  {
    id: 'sanskrit',
    name: 'Sanskrit',
    nameHi: 'संस्कृत',
    color: 'from-yellow-500 to-amber-600',
    emoji: '🕉️',
    chapters: [
      { id: 'sa-1', name: 'शिशुलालनम्', book: 'Chapter 1' },
      { id: 'sa-2', name: 'जननी तुल्यवत्सला', book: 'Chapter 2' },
      { id: 'sa-3', name: 'सुभाषितानि', book: 'Chapter 3' },
      { id: 'sa-4', name: 'Chapter 4', nameHi: 'पाठः ४' },
      { id: 'sa-5', name: 'Chapter 5', nameHi: 'पाठः ५' },
      { id: 'sa-6', name: 'Chapter 6', nameHi: 'पाठः ६' },
    ],
  },
]

export function findSubject(id: string) {
  return SYLLABUS.find((s) => s.id === id)
}

export function findChapter(subjectId: string, chapterId: string) {
  const subject = findSubject(subjectId)
  const chapter = subject?.chapters.find((c) => c.id === chapterId)
  return { subject, chapter }
}

export function chapterLabel(subject: Subject, chapter: Chapter) {
  const idx = subject.chapters.indexOf(chapter) + 1
  return `${idx}. ${chapter.name}`
}
