import type { Topic } from "@/lib/types";

/**
 * Hardcoded demo lessons about TCP/IP networking.
 * They exist so the teaching experience can be demonstrated before
 * AI-generated lessons grounded in uploaded PDFs are built.
 */
export const tcpIpTopics: Topic[] = [
  {
    id: "packets",
    title: "How data travels across the internet",
    summary:
      "Your message is split into small packets, sent across many networks, and reassembled at the destination.",
    whyItMatters:
      "The internet works because millions of small packets can travel different routes and still arrive in the right order.",
    concepts: [
      {
        id: "split-into-packets",
        title: "Messages are split into packets",
        explanation:
          "When you send a message, your computer does not send it as one big block. It cuts the data into small pieces called packets. Each packet carries a header: a label that says where it came from, where it is going, and which part of the message it is.",
        alternateExplanation:
          "Imagine mailing a long book. Instead of one giant parcel, you post each page in its own numbered envelope. Any single envelope is small and easy to deliver, and the numbers let the reader put the pages back in order.",
        visualization: { type: "packet-transmission", params: { packets: 3, lostPacket: null } },
        question: {
          kind: "mcq",
          prompt: "You send a message to a website. What happens to it before it arrives?",
          options: [
            { id: "a", text: "It goes as one big file directly to the website." },
            { id: "b", text: "It is split into small packets that may take different routes." },
            { id: "c", text: "It is converted into a video and streamed." },
          ],
          correctOptionId: "b",
        },
        whyCorrect:
          "Splitting the message into packets lets each piece travel on its own. A busy or broken link delays only some packets, and the header on each one lets the receiver rebuild the full message.",
        hints: [
          "Think about what the header on each piece is for. Why would a piece need its own label?",
          "One giant block has to fit through every link along the way. Small pieces are easier to move and easier to resend.",
        ],
      },
      {
        id: "why-small-packets",
        title: "Why small pieces beat one big block",
        explanation:
          "Small packets have two advantages. If one packet is lost or damaged, only that packet is sent again, not the whole message. And because each packet travels on its own, packets can take different paths around busy or broken links.",
        alternateExplanation:
          "Compare moving a crowd across a city in one giant bus or in many taxis. If the bus breaks down, everyone is stuck. Taxis can take side streets, and if one is delayed the others still arrive.",
        question: {
          kind: "mcq",
          prompt: "Why are messages split into small packets?",
          options: [
            { id: "a", text: "To make the message look smaller on screen." },
            { id: "b", text: "So the pieces can take different routes and be resent one at a time if lost." },
            { id: "c", text: "Because computers can only store small files." },
            { id: "d", text: "To make the internet faster for videos only." },
          ],
          correctOptionId: "b",
        },
        whyCorrect:
          "Independent packets make delivery both flexible and reliable: the network can route around problems, and a lost packet costs one small resend instead of the whole message.",
        hints: [
          "Think about what happens when one packet is lost. How much has to be sent again?",
          "Screen size and storage have nothing to do with it. Focus on what happens on the journey.",
        ],
      },
      {
        id: "ip-addresses",
        title: "Every packet carries an address",
        explanation:
          "Every device on the internet has an IP address, a number that identifies it, such as 142.250.72.14. Each packet header holds two IP addresses: the source (your device) and the destination (the website's server). The network uses the destination address to decide where to send the packet next.",
        alternateExplanation:
          "An IP address works like the address on an envelope. The postal service never reads your letter; it only reads the address on the outside and moves the envelope closer to it. Routers do the same with the destination IP in the packet header.",
        question: {
          kind: "mcq",
          prompt: "What do the IP addresses in a packet header tell the network?",
          options: [
            { id: "a", text: "The password for the website." },
            { id: "b", text: "Which device sent the packet and which device should receive it." },
            { id: "c", text: "How large the whole message is." },
            { id: "d", text: "The name of the website, like google.com." },
          ],
          correctOptionId: "b",
        },
        whyCorrect:
          "Source and destination IP addresses are the 'from' and 'to' on the envelope. Names like google.com are turned into IP addresses by DNS before the packet is sent; the packet itself only carries the numbers.",
        hints: [
          "Think of an envelope. What two things are written on the outside?",
          "The header is only about delivery, not about the content or the website's name.",
        ],
      },
      {
        id: "routing",
        title: "Routers choose the path, hop by hop",
        explanation:
          "Between your computer and the website there are many networks joined by routers. Each router reads the destination address, looks up which neighbour is closer to it, and forwards the packet. No router knows the whole path; each one just picks the next hop. Because conditions change, two packets from the same message can take different routes.",
        alternateExplanation:
          "Think of asking for directions in an unfamiliar city. Nobody gives you the whole route; each person points you to the next corner. If a road is closed, the next person simply points you a different way.",
        illustration: "routes",
        question: {
          kind: "short",
          prompt: "In one or two sentences, explain how a message travels from your computer to a website.",
          placeholder: "Type your answer here...",
          keywordGroups: [
            ["packet", "packets", "pieces", "chunks"],
            ["router", "routers", "route", "routes", "path", "paths", "hop", "hops", "network", "networks"],
            [
              "reassemble",
              "reassembled",
              "reassembles",
              "order",
              "together",
              "rebuilt",
              "rebuild",
              "recombined",
              "destination",
              "arrive",
              "arrives",
            ],
          ],
          minGroups: 2,
          sampleAnswer:
            "The message is split into packets. Each packet carries the destination address, and routers pass it from one network to the next, so packets may take different routes. At the destination the packets are put back in order to rebuild the message.",
        },
        whyCorrect:
          "You described the key steps: data is broken into packets, routers forward each one hop by hop using its destination address, and the pieces come back together at the end.",
        hints: [
          "Start with what your computer does to the message before sending it.",
          "Then say who moves the pieces along the way, and what happens when they arrive.",
        ],
      },
      {
        id: "reassembly",
        title: "Reassembly at the destination",
        explanation:
          "Packets can arrive out of order, because they took different routes, and some may not arrive at all. Each packet carries a sequence number. The receiving computer uses those numbers to put the packets back in order, notices any gap, and asks for the missing packet to be sent again. Only then is the complete message handed to the application.",
        alternateExplanation:
          "Back to the numbered envelopes: if page 7 arrives before page 5, you simply sort them by number. If page 6 never arrives, you know exactly which one to ask for again.",
        visualization: { type: "packet-transmission", params: { packets: 4, lostPacket: 3 } },
        question: {
          kind: "mcq",
          prompt: "Packets from one message arrive out of order. What happens?",
          options: [
            { id: "a", text: "The message is thrown away and the website sends everything again." },
            { id: "b", text: "The receiver uses the sequence numbers to put the packets back in order." },
            { id: "c", text: "The user sees the text in a scrambled order." },
            { id: "d", text: "The router that caused the delay fixes the order." },
          ],
          correctOptionId: "b",
        },
        whyCorrect:
          "Sequence numbers make order a non-problem: the receiver sorts the packets and requests only what is missing, so out-of-order delivery never reaches the application.",
        hints: [
          "Each packet carries a number. What is that number for?",
          "Routers only forward packets. Think about what the receiving computer can do with the numbers.",
        ],
      },
    ],
  },
  {
    id: "tcp-udp",
    title: "TCP and UDP: reliable or fast",
    summary:
      "Two transport protocols make different promises: TCP guarantees delivery, UDP trades guarantees for speed.",
    whyItMatters:
      "Choosing the wrong protocol makes a download corrupt or a video call laggy. Every network app makes this choice.",
    concepts: [
      {
        id: "tcp-reliable",
        title: "TCP guarantees delivery",
        explanation:
          "TCP (Transmission Control Protocol) makes sure every byte arrives, complete and in order. The sender numbers each segment, the receiver sends back an acknowledgement for what it got, and anything not acknowledged in time is sent again. TCP also slows down when the network is congested.",
        alternateExplanation:
          "TCP is like sending registered mail with return receipts. For every parcel you post, you wait for a receipt. No receipt within a reasonable time means you post that parcel again.",
        question: {
          kind: "mcq",
          prompt: "A TCP packet is lost on the way. What happens next?",
          options: [
            { id: "a", text: "TCP gives up and reports an error to the user." },
            { id: "b", text: "The sender notices no acknowledgement arrived and resends that packet." },
            { id: "c", text: "The receiver guesses the missing content from the packets around it." },
            { id: "d", text: "Nothing; the gap is ignored." },
          ],
          correctOptionId: "b",
        },
        whyCorrect:
          "Acknowledgements are the heart of TCP's reliability: the sender keeps a copy of every unacknowledged segment and retransmits it, so the receiver eventually has every byte.",
        hints: [
          "Think about the return receipt. What does the sender do when it never arrives?",
          "Guessing or ignoring would corrupt the data; TCP's whole promise is that this cannot happen.",
        ],
      },
      {
        id: "handshake",
        title: "The three-way handshake",
        explanation:
          "Before any data is sent, TCP opens a connection with three messages. The client sends SYN ('I want to connect, here is my starting number'). The server replies SYN-ACK ('Got it, here is mine'). The client answers ACK ('Got yours too'). Both sides now agree on numbering and are ready to exchange data.",
        alternateExplanation:
          "It is like a phone call. You say 'Hello, can you hear me?', they answer 'Yes, can you hear me?', and you say 'Yes.' Only then does the real conversation start.",
        illustration: "handshake",
        question: {
          kind: "mcq",
          prompt: "Which sequence of messages opens a TCP connection?",
          options: [
            { id: "a", text: "SYN, then SYN-ACK, then ACK" },
            { id: "b", text: "ACK, then SYN, then FIN" },
            { id: "c", text: "DATA, then ACK" },
            { id: "d", text: "HELLO, then OK" },
          ],
          correctOptionId: "a",
        },
        whyCorrect:
          "Three messages are the minimum for both sides to confirm they can hear each other and to agree on starting sequence numbers. FIN is used to close a connection, not open it.",
        hints: [
          "The client speaks first, and the server's reply does two jobs at once.",
          "The sequence ends when the client confirms it heard the server.",
        ],
      },
      {
        id: "udp-fast",
        title: "UDP: fast, with no guarantees",
        explanation:
          "UDP (User Datagram Protocol) skips the handshake, the acknowledgements and the resending. It just sends packets. That makes it faster and lighter, but packets can be lost or arrive out of order and UDP will not fix it. It suits live video, voice calls, online games and DNS lookups, where a late packet is useless anyway.",
        alternateExplanation:
          "In a live video call, a frame that arrives two seconds late is worthless; you would rather skip it and show the next one. Waiting for resends would make the call stutter. That is why real-time apps choose UDP.",
        question: {
          kind: "short",
          prompt:
            "Name an app or service that should use UDP, and explain in one sentence why losing a packet now and then is acceptable for it.",
          placeholder: "For example: ... should use UDP because ...",
          keywordGroups: [
            [
              "video",
              "call",
              "calls",
              "stream",
              "streaming",
              "game",
              "games",
              "gaming",
              "voice",
              "live",
              "dns",
              "zoom",
              "teams",
              "discord",
            ],
            [
              "fast",
              "faster",
              "speed",
              "delay",
              "latency",
              "real-time",
              "real time",
              "realtime",
              "quick",
              "late",
              "old",
              "wait",
              "waiting",
              "stutter",
              "lag",
            ],
          ],
          minGroups: 2,
          sampleAnswer:
            "A video call should use UDP because a frame that arrives late is useless; it is better to skip a lost packet and keep the call moving than to wait for a resend.",
        },
        whyCorrect:
          "You matched the app to UDP's trade-off: real-time apps care more about low delay than about receiving every single packet.",
        hints: [
          "Think of something that happens live, where old data is no longer useful.",
          "Say what would go wrong if the app stopped to wait for a missing packet.",
        ],
      },
      {
        id: "choose-protocol",
        title: "Choosing between TCP and UDP",
        explanation:
          "The rule of thumb: if every byte must arrive intact, use TCP (web pages, email, file downloads). If being on time matters more than being complete, use UDP (calls, live video, games). Many apps use both, for example a game that uses TCP for the login and UDP for player movement.",
        alternateExplanation:
          "Ask one question: would a late packet still be useful? For a file, yes, you need all of it eventually. For a live stream, no, the moment has passed.",
        question: {
          kind: "mcq",
          prompt: "You are downloading a software installer. Which protocol fits best, and why?",
          options: [
            { id: "a", text: "UDP, because downloads should be as fast as possible." },
            { id: "b", text: "TCP, because every byte of the file must arrive intact." },
            { id: "c", text: "Either one; there is no difference for files." },
            { id: "d", text: "Neither; files are sent without a transport protocol." },
          ],
          correctOptionId: "b",
        },
        whyCorrect:
          "An installer with a single missing byte will not run. TCP's acknowledgements and resends guarantee the whole file arrives exactly as sent, which is worth a little extra delay.",
        hints: [
          "What happens if a single piece of the installer is missing when you run it?",
          "Speed matters, but think about which protocol can promise the file is complete.",
        ],
      },
    ],
  },
  {
    id: "layers",
    title: "The TCP/IP layers",
    summary: "Networking is organised as four layers, each with one job, stacked on top of each other.",
    whyItMatters:
      "Layers let a web browser work over Wi-Fi, fibre or 5G without changing a line of code, and they are how engineers find where a network problem lives.",
    concepts: [
      {
        id: "four-layers",
        title: "Four layers, one job each",
        explanation:
          "TCP/IP has four layers. The Application layer is the program you use (web, email) and its protocols (HTTP, SMTP). The Transport layer (TCP or UDP) delivers data between apps. The Internet layer (IP) addresses packets and routes them between networks. The Link layer (Ethernet, Wi-Fi) moves bits over the physical connection to the next device.",
        alternateExplanation:
          "Think of a shipping company. The customer writes the letter (Application). The mailroom decides how to track the parcel (Transport). The logistics team plans the route between cities (Internet). The trucks and planes physically carry it one leg at a time (Link).",
        illustration: "layers",
        question: {
          kind: "mcq",
          prompt: "Which layer decides how a packet is routed from one network to another?",
          options: [
            { id: "a", text: "Application" },
            { id: "b", text: "Transport" },
            { id: "c", text: "Internet" },
            { id: "d", text: "Link" },
          ],
          correctOptionId: "c",
        },
        whyCorrect:
          "The Internet layer is where IP lives. It gives packets their addresses, and routers use those addresses to move packets between networks. Transport works between apps; Link works only between neighbouring devices.",
        hints: [
          "Which layer is IP, the protocol that routers read, part of?",
          "The Link layer only reaches the next device on the same cable or Wi-Fi network; routing between networks happens one layer up.",
        ],
      },
      {
        id: "encapsulation",
        title: "Encapsulation: wrapping data on the way down",
        explanation:
          "When data is sent, it passes down the layers, and each layer adds its own header in front of what it received. The app's data gets a TCP header (ports, sequence numbers), then an IP header (addresses), then a link header (local hardware addresses). At the receiver the layers peel the headers off in reverse order.",
        alternateExplanation:
          "It is like putting a letter in an envelope, that envelope in a courier bag, and the bag in a shipping container. Each wrapper carries the information that one stage of the journey needs, and each is removed at the right point.",
        visualization: { type: "protocol-layers", params: { model: "tcp-ip" } },
        question: {
          kind: "mcq",
          prompt: "As data moves down the layers to be sent, what happens at each layer?",
          options: [
            { id: "a", text: "The data is compressed to make it smaller." },
            { id: "b", text: "A header with that layer's information is added in front of the data." },
            { id: "c", text: "The data is encrypted again." },
            { id: "d", text: "The data is converted into a different file type." },
          ],
          correctOptionId: "b",
        },
        whyCorrect:
          "Each layer only needs its own header to do its job, so it wraps the data from above without changing it. That is why the layers stay independent of each other.",
        hints: [
          "Think of the envelope inside the courier bag. What does each wrapper add?",
          "Compression and encryption can happen, but they are not what every layer does. Focus on the labels.",
        ],
      },
      {
        id: "ports",
        title: "Ports: which app gets the data",
        explanation:
          "An IP address identifies a device, but a device runs many apps at once. The Transport layer adds a port number to each segment so the receiving computer knows which app the data belongs to. Web servers listen on port 443 (HTTPS) or 80 (HTTP), email on 25 or 587, and your browser uses a temporary port for each connection.",
        alternateExplanation:
          "An IP address is the street address of an apartment building; the port number is the apartment number. The post reaches the building with the first and the right door with the second.",
        question: {
          kind: "mcq",
          prompt:
            "A browser and a game on your laptop receive data at the same time. How does the transport layer know which app gets which packet?",
          options: [
            { id: "a", text: "By the IP address of your laptop." },
            { id: "b", text: "By the port number in the transport header." },
            { id: "c", text: "By the size of the packet." },
            { id: "d", text: "By the time the packet arrives." },
          ],
          correctOptionId: "b",
        },
        whyCorrect:
          "Both apps share the same IP address, so the IP address cannot tell them apart. Port numbers are exactly the extra label that routes data to the right program.",
        hints: [
          "Both apps are on the same device, so they share the same IP address. What extra label is needed?",
          "Think of the apartment number on an envelope.",
        ],
      },
      {
        id: "putting-it-together",
        title: "Putting it together: loading a web page",
        explanation:
          "When you open a web page: the browser (Application) builds an HTTP request. TCP (Transport) opens a connection with the handshake and numbers the data, addressed to port 443. IP (Internet) wraps each segment with the server's address, and routers forward it hop by hop. Wi-Fi or Ethernet (Link) carries each packet to the next device. The server unwraps the layers in reverse and answers the same way.",
        alternateExplanation:
          "Follow one click down the stack and back up: the request is written, tracked, addressed and carried; on the other side it is carried, addressed, tracked and read.",
        question: {
          kind: "short",
          prompt:
            "Describe, layer by layer, what happens when you open a web page. Mention at least three of the four layers.",
          placeholder: "The browser ... then TCP ... then IP ... then Wi-Fi or Ethernet ...",
          keywordGroups: [
            ["application", "browser", "http", "https", "web page", "request"],
            ["transport", "tcp", "port", "ports", "segment", "handshake", "udp"],
            ["internet layer", "ip", "address", "addresses", "packet", "packets", "route", "routes", "router", "routers"],
            ["link", "ethernet", "wi-fi", "wifi", "frame", "frames", "physical", "cable", "radio", "5g"],
          ],
          minGroups: 3,
          sampleAnswer:
            "The browser builds an HTTP request (Application). TCP opens a connection and numbers the data, addressed to port 443 (Transport). IP adds the server's address and routers forward the packets (Internet). Wi-Fi or Ethernet carries each packet to the next device (Link). The server unwraps the layers in reverse order and replies.",
        },
        whyCorrect:
          "You walked the request down the stack: the app builds it, transport makes it reliable, the internet layer addresses and routes it, and the link layer carries it. That is the whole TCP/IP model in one click.",
        hints: [
          "Start at the top: which program creates the request, and what does it ask for?",
          "Then name what each lower layer adds: reliability and ports, addresses and routing, and the physical connection.",
        ],
      },
    ],
  },
  {
    id: "pcm",
    title: "From analog to digital: PCM",
    summary: "Pulse code modulation turns a smooth analog signal into bits in three moves: sample, quantize, encode.",
    whyItMatters:
      "Every phone call, song and sensor reading starts as an analog signal. The sampling rate and the bits per sample decide both the quality and the bit rate of the digital channel; the classic 64 kbit/s telephone channel comes straight from those two numbers.",
    concepts: [
      {
        id: "sampling",
        title: "Sampling: measuring the signal in time",
        explanation:
          "An analog signal, such as a voice at a microphone, changes smoothly and has a value at every instant. A computer cannot store that. Sampling measures the signal at regular instants, a fixed number of times per second (the sampling rate), and keeps only those measurements. The signal becomes a list of numbers, one per sample.",
        alternateExplanation:
          "Think of a flip book. A smooth movement is captured as a series of still pictures taken at regular intervals. Flip through them fast enough and the movement looks continuous again; the pictures are the samples.",
        visualization: { type: "pcm-sampling", params: { signalHz: 2, sampleRate: 12, bits: 3 } },
        question: {
          kind: "mcq",
          prompt: "What does sampling do to an analog signal?",
          options: [
            { id: "a", text: "It measures the signal at regular instants, turning a smooth curve into a list of values." },
            { id: "b", text: "It amplifies the signal so it can travel further." },
            { id: "c", text: "It removes the noise from the signal." },
            { id: "d", text: "It converts the signal from volts to bits in one step." },
          ],
          correctOptionId: "a",
        },
        whyCorrect:
          "Sampling only decides when the signal is measured. It produces values, not bits yet; quantizing and encoding turn those values into binary codes in the next steps.",
        hints: [
          "Think about the flip book. What does each picture correspond to?",
          "Sampling is about time: how often you look at the signal, not how loud or how clean it is.",
        ],
      },
      {
        id: "quantization",
        title: "Quantizing and encoding: rounding to levels",
        explanation:
          "A sample can take any value, but a code of n bits can only name 2 to the power n different levels. Quantizing rounds each sample to the nearest level; the small difference that is lost is quantization error, heard as a faint hiss. Encoding then writes each level as its n-bit code. With 8 bits per sample there are 256 levels, and the bit rate is the sampling rate multiplied by the bits per sample.",
        alternateExplanation:
          "Measuring your height with a ruler marked only in whole centimetres is quantizing: 171.4 cm becomes 171 cm. More marks on the ruler (more bits) mean a smaller rounding error, but every reading needs more digits to write down.",
        question: {
          kind: "mcq",
          prompt: "A PCM system uses 3 bits per sample. How many different levels can each sample take?",
          options: [
            { id: "a", text: "3" },
            { id: "b", text: "6" },
            { id: "c", text: "8" },
            { id: "d", text: "16" },
          ],
          correctOptionId: "c",
        },
        whyCorrect:
          "Each extra bit doubles the number of codes: 3 bits give 2 x 2 x 2 = 8 codes, from 000 to 111, so there are 8 levels to round to.",
        hints: [
          "How many different patterns can you write with three binary digits?",
          "Count them: 000, 001, 010, ... What is the last one, and how many is that in total?",
        ],
      },
      {
        id: "nyquist",
        title: "The Nyquist rate: how often to sample",
        explanation:
          "Sample too slowly and whole swings of the signal fall between the samples; the receiver rebuilds a different, slower wave. That is aliasing. The Nyquist rule says the sampling rate must be more than twice the highest frequency in the signal. Telephone voice is limited to about 4 kHz, so it is sampled 8000 times per second; with 8 bits per sample that gives the 64 kbit/s channel.",
        alternateExplanation:
          "Watch a wheel in a film shot at 24 frames per second. If the wheel turns almost once per frame, it seems to stand still or spin backwards: the camera samples too slowly for the wheel's speed. Sampling fast enough compared with the fastest change avoids that illusion.",
        visualization: { type: "pcm-sampling", params: { signalHz: 3, sampleRate: 4, bits: 3 } },
        question: {
          kind: "mcq",
          prompt: "A signal contains frequencies up to 4 kHz. What is the minimum sampling rate that lets the receiver rebuild it faithfully?",
          options: [
            { id: "a", text: "2000 samples per second" },
            { id: "b", text: "4000 samples per second" },
            { id: "c", text: "8000 samples per second" },
            { id: "d", text: "16 000 samples per second" },
          ],
          correctOptionId: "c",
        },
        whyCorrect:
          "The sampling rate must exceed twice the highest frequency: 2 x 4 kHz = 8 kHz, so 8000 samples per second, which is exactly the rate telephone networks use.",
        hints: [
          "The rule compares the sampling rate with the highest frequency in the signal. What is the multiplier?",
          "Double the highest frequency and you have the answer.",
        ],
      },
    ],
  },
];
