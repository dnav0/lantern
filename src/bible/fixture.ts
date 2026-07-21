import type { BibleProvider, BibleVerseLine } from './provider'
import { CodedError } from '../errors'

// Offline BSB text for the handful of chapters seedMemoryApi references, so a
// dev or an agent with no network still sees real scripture instead of a thrown
// fetch. Generated from bible.helloao.org with the same flatten logic as
// helloao.ts, so the text matches the network response exactly.
//
// This is a DEV-ONLY stopgap, wired in service.ts behind import.meta.env.DEV and
// tree-shaken out of production. The real answer for offline readers is the
// full-BSB prefetch (docs/BACKLOG.md) — four chapters is a fixture, not a Bible.
//
// Regenerate (needs network): node scripts/gen-bible-fixture.mjs src/bible/fixture.ts
// Add a chapter to WANTED there whenever seedMemoryApi grows a new passage.

const CHAPTERS: Record<string, BibleVerseLine[]> = {
  '1/1': [
    { verse: 1, text: 'In the beginning God created the heavens and the earth.' },
    {
      verse: 2,
      text: 'Now the earth was formless and void, and darkness was over the surface of the deep. And the Spirit of God was hovering over the surface of the waters.'
    },
    { verse: 3, text: 'And God said, “Let there be light,” and there was light.' },
    {
      verse: 4,
      text: 'And God saw that the light was good, and He separated the light from the darkness.'
    },
    {
      verse: 5,
      text: 'God called the light “day,” and the darkness He called “night.” And there was evening, and there was morning—the first day.'
    },
    {
      verse: 6,
      text: 'And God said, “Let there be an expanse between the waters, to separate the waters from the waters.”'
    },
    {
      verse: 7,
      text: 'So God made the expanse and separated the waters beneath it from the waters above. And it was so.'
    },
    {
      verse: 8,
      text: 'God called the expanse “sky.” And there was evening, and there was morning—the second day.'
    },
    {
      verse: 9,
      text: 'And God said, “Let the waters under the sky be gathered into one place, so that the dry land may appear.” And it was so.'
    },
    {
      verse: 10,
      text: 'God called the dry land “earth,” and the gathering of waters He called “seas.” And God saw that it was good.'
    },
    {
      verse: 11,
      text: 'Then God said, “Let the earth bring forth vegetation: seed-bearing plants and fruit trees, each bearing fruit with seed according to its kind.” And it was so.'
    },
    {
      verse: 12,
      text: 'The earth produced vegetation: seed-bearing plants according to their kinds and trees bearing fruit with seed according to their kinds. And God saw that it was good.'
    },
    { verse: 13, text: 'And there was evening, and there was morning—the third day.' },
    {
      verse: 14,
      text: 'And God said, “Let there be lights in the expanse of the sky to distinguish between the day and the night, and let them be signs to mark the seasons and days and years.'
    },
    {
      verse: 15,
      text: 'And let them serve as lights in the expanse of the sky to shine upon the earth.” And it was so.'
    },
    {
      verse: 16,
      text: 'God made two great lights: the greater light to rule the day and the lesser light to rule the night. And He made the stars as well.'
    },
    { verse: 17, text: 'God set these lights in the expanse of the sky to shine upon the earth,' },
    {
      verse: 18,
      text: 'to preside over the day and the night, and to separate the light from the darkness. And God saw that it was good.'
    },
    { verse: 19, text: 'And there was evening, and there was morning—the fourth day.' },
    {
      verse: 20,
      text: 'And God said, “Let the waters teem with living creatures, and let birds fly above the earth in the open expanse of the sky.”'
    },
    {
      verse: 21,
      text: 'So God created the great sea creatures and every living thing that moves, with which the waters teemed according to their kinds, and every winged bird after its kind. And God saw that it was good.'
    },
    {
      verse: 22,
      text: 'Then God blessed them and said, “Be fruitful and multiply and fill the waters of the seas, and let birds multiply on the earth.”'
    },
    { verse: 23, text: 'And there was evening, and there was morning—the fifth day.' },
    {
      verse: 24,
      text: 'And God said, “Let the earth bring forth living creatures according to their kinds: livestock, land crawlers, and beasts of the earth according to their kinds.” And it was so.'
    },
    {
      verse: 25,
      text: 'God made the beasts of the earth according to their kinds, the livestock according to their kinds, and everything that crawls upon the earth according to its kind. And God saw that it was good.'
    },
    {
      verse: 26,
      text: 'Then God said, “Let Us make man in Our image, after Our likeness, to rule over the fish of the sea and the birds of the air, over the livestock, and over all the earth itself and every creature that crawls upon it.”'
    },
    {
      verse: 27,
      text: 'So God created man in His own image; in the image of God He created him; male and female He created them.'
    },
    {
      verse: 28,
      text: 'God blessed them and said to them, “Be fruitful and multiply, and fill the earth and subdue it; rule over the fish of the sea and the birds of the air and every creature that crawls upon the earth.”'
    },
    {
      verse: 29,
      text: 'Then God said, “Behold, I have given you every seed-bearing plant on the face of all the earth, and every tree whose fruit contains seed. They will be yours for food.'
    },
    {
      verse: 30,
      text: 'And to every beast of the earth and every bird of the air and every creature that crawls upon the earth—everything that has the breath of life in it—I have given every green plant for food.” And it was so.'
    },
    {
      verse: 31,
      text: 'And God looked upon all that He had made, and indeed, it was very good. And there was evening, and there was morning—the sixth day.'
    }
  ],
  '19/23': [
    { verse: 1, text: 'The LORD is my shepherd; I shall not want.' },
    { verse: 2, text: 'He makes me lie down in green pastures; He leads me beside quiet waters.' },
    {
      verse: 3,
      text: 'He restores my soul; He guides me in the paths of righteousness for the sake of His name.'
    },
    {
      verse: 4,
      text: 'Even though I walk through the valley of the shadow of death, I will fear no evil, for You are with me; Your rod and Your staff, they comfort me.'
    },
    {
      verse: 5,
      text: 'You prepare a table before me in the presence of my enemies. You anoint my head with oil; my cup overflows.'
    },
    {
      verse: 6,
      text: 'Surely goodness and mercy will follow me all the days of my life, and I will dwell in the house of the LORD forever.'
    }
  ],
  '43/1': [
    {
      verse: 1,
      text: 'In the beginning was the Word, and the Word was with God, and the Word was God.'
    },
    { verse: 2, text: 'He was with God in the beginning.' },
    {
      verse: 3,
      text: 'Through Him all things were made, and without Him nothing was made that has been made.'
    },
    { verse: 4, text: 'In Him was life, and that life was the light of men.' },
    { verse: 5, text: 'The Light shines in the darkness, and the darkness has not overcome it.' },
    { verse: 6, text: 'There came a man who was sent from God. His name was John.' },
    {
      verse: 7,
      text: 'He came as a witness to testify about the Light, so that through him everyone might believe.'
    },
    { verse: 8, text: 'He himself was not the Light, but he came to testify about the Light.' },
    { verse: 9, text: 'The true Light, who gives light to everyone, was coming into the world.' },
    {
      verse: 10,
      text: 'He was in the world, and though the world was made through Him, the world did not recognize Him.'
    },
    { verse: 11, text: 'He came to His own, and His own did not receive Him.' },
    {
      verse: 12,
      text: 'But to all who did receive Him, to those who believed in His name, He gave the right to become children of God—'
    },
    {
      verse: 13,
      text: 'children born not of blood, nor of the desire or will of man, but born of God.'
    },
    {
      verse: 14,
      text: 'The Word became flesh and made His dwelling among us. We have seen His glory, the glory of the one and only Son from the Father, full of grace and truth.'
    },
    {
      verse: 15,
      text: 'John testified concerning Him. He cried out, saying, “This is He of whom I said, ‘He who comes after me has surpassed me because He was before me.’”'
    },
    { verse: 16, text: 'From His fullness we have all received grace upon grace.' },
    {
      verse: 17,
      text: 'For the law was given through Moses; grace and truth came through Jesus Christ.'
    },
    {
      verse: 18,
      text: 'No one has ever seen God, but the one and only Son, who is Himself God and is at the Father’s side, has made Him known.'
    },
    {
      verse: 19,
      text: 'And this was John’s testimony when the Jews of Jerusalem sent priests and Levites to ask him, “Who are you?”'
    },
    {
      verse: 20,
      text: 'He did not refuse to confess, but openly declared, “I am not the Christ.”'
    },
    {
      verse: 21,
      text: '“Then who are you?” they inquired. “Are you Elijah?” He said, “I am not.” “Are you the Prophet?” He answered, “No.”'
    },
    {
      verse: 22,
      text: 'So they said to him, “Who are you? We need an answer for those who sent us. What do you say about yourself?”'
    },
    {
      verse: 23,
      text: 'John replied in the words of Isaiah the prophet: “I am a voice of one calling in the wilderness, ‘Make straight the way for the Lord.’”'
    },
    { verse: 24, text: 'Then the Pharisees who had been sent' },
    {
      verse: 25,
      text: 'asked him, “Why then do you baptize, if you are not the Christ, nor Elijah, nor the Prophet?”'
    },
    {
      verse: 26,
      text: '“I baptize with water,” John replied, “but among you stands One you do not know.'
    },
    {
      verse: 27,
      text: 'He is the One who comes after me, the straps of whose sandals I am not worthy to untie.”'
    },
    {
      verse: 28,
      text: 'All this happened at Bethany beyond the Jordan, where John was baptizing.'
    },
    {
      verse: 29,
      text: 'The next day John saw Jesus coming toward him and said, “Look, the Lamb of God, who takes away the sin of the world!'
    },
    {
      verse: 30,
      text: 'This is He of whom I said, ‘A man who comes after me has surpassed me because He was before me.’'
    },
    {
      verse: 31,
      text: 'I myself did not know Him, but the reason I came baptizing with water was that He might be revealed to Israel.”'
    },
    {
      verse: 32,
      text: 'Then John testified, “I saw the Spirit descending from heaven like a dove and resting on Him.'
    },
    {
      verse: 33,
      text: 'I myself did not know Him, but the One who sent me to baptize with water told me, ‘The man on whom you see the Spirit descend and rest is He who will baptize with the Holy Spirit.’'
    },
    { verse: 34, text: 'I have seen and testified that this is the Son of God.”' },
    { verse: 35, text: 'The next day John was there again with two of his disciples.' },
    { verse: 36, text: 'When he saw Jesus walking by, he said, “Look, the Lamb of God!”' },
    { verse: 37, text: 'And when the two disciples heard him say this, they followed Jesus.' },
    {
      verse: 38,
      text: 'Jesus turned and saw them following. “What do you want?” He asked. They said to Him, “Rabbi” (which means Teacher), “where are You staying?”'
    },
    {
      verse: 39,
      text: '“Come and see,” He replied. So they went and saw where He was staying, and spent that day with Him. It was about the tenth hour.'
    },
    {
      verse: 40,
      text: 'Andrew, Simon Peter’s brother, was one of the two who heard John’s testimony and followed Jesus.'
    },
    {
      verse: 41,
      text: 'He first found his brother Simon and told him, “We have found the Messiah” (which is translated as Christ).'
    },
    {
      verse: 42,
      text: 'Andrew brought him to Jesus, who looked at him and said, “You are Simon son of John. You will be called Cephas” (which is translated as Peter).'
    },
    {
      verse: 43,
      text: 'The next day Jesus decided to set out for Galilee. Finding Philip, He told him, “Follow Me.”'
    },
    { verse: 44, text: 'Now Philip was from Bethsaida, the same town as Andrew and Peter.' },
    {
      verse: 45,
      text: 'Philip found Nathanael and told him, “We have found the One Moses wrote about in the Law, the One the prophets foretold—Jesus of Nazareth, the son of Joseph.”'
    },
    {
      verse: 46,
      text: '“Can anything good come from Nazareth?” Nathanael asked. “Come and see,” said Philip.'
    },
    {
      verse: 47,
      text: 'When Jesus saw Nathanael approaching, He said of him, “Here is a true Israelite, in whom there is no deceit.”'
    },
    {
      verse: 48,
      text: '“How do You know me?” Nathanael asked. Jesus replied, “Before Philip called you, I saw you under the fig tree.”'
    },
    {
      verse: 49,
      text: '“Rabbi,” Nathanael answered, “You are the Son of God! You are the King of Israel!”'
    },
    {
      verse: 50,
      text: 'Jesus said to him, “Do you believe just because I told you I saw you under the fig tree? You will see greater things than these.”'
    },
    {
      verse: 51,
      text: 'Then He declared, “Truly, truly, I tell you, you will all see heaven open and the angels of God ascending and descending on the Son of Man.”'
    }
  ],
  '45/8': [
    {
      verse: 1,
      text: 'Therefore, there is now no condemnation for those who are in Christ Jesus.'
    },
    {
      verse: 2,
      text: 'For in Christ Jesus the law of the Spirit of life set you free from the law of sin and death.'
    },
    {
      verse: 3,
      text: 'For what the law was powerless to do in that it was weakened by the flesh, God did by sending His own Son in the likeness of sinful man, as an offering for sin. He thus condemned sin in the flesh,'
    },
    {
      verse: 4,
      text: 'so that the righteous standard of the law might be fulfilled in us, who do not walk according to the flesh but according to the Spirit.'
    },
    {
      verse: 5,
      text: 'Those who live according to the flesh set their minds on the things of the flesh; but those who live according to the Spirit set their minds on the things of the Spirit.'
    },
    {
      verse: 6,
      text: 'The mind of the flesh is death, but the mind of the Spirit is life and peace,'
    },
    {
      verse: 7,
      text: 'because the mind of the flesh is hostile to God: It does not submit to God’s law, nor can it do so.'
    },
    { verse: 8, text: 'Those controlled by the flesh cannot please God.' },
    {
      verse: 9,
      text: 'You, however, are controlled not by the flesh, but by the Spirit, if the Spirit of God lives in you. And if anyone does not have the Spirit of Christ, he does not belong to Christ.'
    },
    {
      verse: 10,
      text: 'But if Christ is in you, your body is dead because of sin, yet your spirit is alive because of righteousness.'
    },
    {
      verse: 11,
      text: 'And if the Spirit of Him who raised Jesus from the dead is living in you, He who raised Christ Jesus from the dead will also give life to your mortal bodies through His Spirit, who lives in you.'
    },
    {
      verse: 12,
      text: 'Therefore, brothers, we have an obligation, but it is not to the flesh, to live according to it.'
    },
    {
      verse: 13,
      text: 'For if you live according to the flesh, you will die; but if by the Spirit you put to death the deeds of the body, you will live.'
    },
    { verse: 14, text: 'For all who are led by the Spirit of God are sons of God.' },
    {
      verse: 15,
      text: 'For you did not receive a spirit of slavery that returns you to fear, but you received the Spirit of adoption to sonship, by whom we cry, “Abba! Father!”'
    },
    { verse: 16, text: 'The Spirit Himself testifies with our spirit that we are God’s children.' },
    {
      verse: 17,
      text: 'And if we are children, then we are heirs: heirs of God and co-heirs with Christ—if indeed we suffer with Him, so that we may also be glorified with Him.'
    },
    {
      verse: 18,
      text: 'I consider that our present sufferings are not comparable to the glory that will be revealed in us.'
    },
    {
      verse: 19,
      text: 'The creation waits in eager expectation for the revelation of the sons of God.'
    },
    {
      verse: 20,
      text: 'For the creation was subjected to futility, not by its own will, but because of the One who subjected it, in hope'
    },
    {
      verse: 21,
      text: 'that the creation itself will be set free from its bondage to decay and brought into the glorious freedom of the children of God.'
    },
    {
      verse: 22,
      text: 'We know that the whole creation has been groaning together in the pains of childbirth until the present time.'
    },
    {
      verse: 23,
      text: 'Not only that, but we ourselves, who have the firstfruits of the Spirit, groan inwardly as we wait eagerly for our adoption as sons, the redemption of our bodies.'
    },
    {
      verse: 24,
      text: 'For in this hope we were saved; but hope that is seen is no hope at all. Who hopes for what he can already see?'
    },
    { verse: 25, text: 'But if we hope for what we do not yet see, we wait for it patiently.' },
    {
      verse: 26,
      text: 'In the same way, the Spirit helps us in our weakness. For we do not know how we ought to pray, but the Spirit Himself intercedes for us with groans too deep for words.'
    },
    {
      verse: 27,
      text: 'And He who searches our hearts knows the mind of the Spirit, because the Spirit intercedes for the saints according to the will of God.'
    },
    {
      verse: 28,
      text: 'And we know that God works all things together for the good of those who love Him, who are called according to His purpose.'
    },
    {
      verse: 29,
      text: 'For those God foreknew, He also predestined to be conformed to the image of His Son, so that He would be the firstborn among many brothers.'
    },
    {
      verse: 30,
      text: 'And those He predestined, He also called; those He called, He also justified; those He justified, He also glorified.'
    },
    {
      verse: 31,
      text: 'What then shall we say in response to these things? If God is for us, who can be against us?'
    },
    {
      verse: 32,
      text: 'He who did not spare His own Son but gave Him up for us all, how will He not also, along with Him, freely give us all things?'
    },
    { verse: 33, text: 'Who will bring any charge against God’s elect? It is God who justifies.' },
    {
      verse: 34,
      text: 'Who is there to condemn us? For Christ Jesus, who died, and more than that was raised to life, is at the right hand of God—and He is interceding for us.'
    },
    {
      verse: 35,
      text: 'Who shall separate us from the love of Christ? Shall trouble or distress or persecution or famine or nakedness or danger or sword?'
    },
    {
      verse: 36,
      text: 'As it is written: “For Your sake we face death all day long; we are considered as sheep to be slaughtered.”'
    },
    {
      verse: 37,
      text: 'No, in all these things we are more than conquerors through Him who loved us.'
    },
    {
      verse: 38,
      text: 'For I am convinced that neither death nor life, neither angels nor principalities, neither the present nor the future, nor any powers,'
    },
    {
      verse: 39,
      text: 'neither height nor depth, nor anything else in all creation, will be able to separate us from the love of God that is in Christ Jesus our Lord.'
    }
  ]
}

export class FixtureBibleProvider implements BibleProvider {
  async getChapter(bookNumber: number, chapter: number): Promise<BibleVerseLine[]> {
    const verses = CHAPTERS[`${bookNumber}/${chapter}`]
    if (!verses) {
      throw new CodedError(
        'BIBLE_FIXTURE_CHAPTER_MISSING',
        `No offline fixture for book ${bookNumber} chapter ${chapter}. ` +
          'Only the seeded chapters are bundled — see src/bible/fixture.ts.'
      )
    }
    return verses
  }
}
