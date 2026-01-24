// Mock data for YONO DMC website

export interface Package {
  id: string;
  title: string;
  destination: string;
  duration: string;
  price: number;
  image: string;
  inclusions: string[];
  type: 'couple' | 'family' | 'honeymoon' | 'adventure';
}

export interface Destination {
  id: string;
  name: string;
  tagline: string;
  image: string;
  packages: number;
}

export interface Testimonial {
  id: string;
  name: string;
  location: string;
  rating: number;
  comment: string;
  image: string;
}

export const packages: Package[] = [
  {
    id: '1',
    title: 'Magical Dubai Experience',
    destination: 'Dubai',
    duration: '5D/4N',
    price: 45999,
    image: 'https://images.unsplash.com/photo-1768069794857-9306ac167c6e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxEdWJhaSUyMHNreWxpbmUlMjBzdW5zZXR8ZW58MXx8fHwxNzY5MTQyMjk1fDA&ixlib=rb-4.1.0&q=80&w=1080',
    inclusions: ['Flights', 'Hotels', 'Transfers', 'City Tour'],
    type: 'family'
  },
  {
    id: '2',
    title: 'Romantic Bali Getaway',
    destination: 'Bali',
    duration: '6D/5N',
    price: 52999,
    image: 'https://images.unsplash.com/photo-1648999637610-a0604610e23f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxCYWxpJTIwYmVhY2glMjB0ZW1wbGV8ZW58MXx8fHwxNzY5MTQ4NTIzfDA&ixlib=rb-4.1.0&q=80&w=1080',
    inclusions: ['Flights', '5* Resort', 'Meals', 'Spa'],
    type: 'honeymoon'
  },
  {
    id: '3',
    title: 'Singapore City Delights',
    destination: 'Singapore',
    duration: '4D/3N',
    price: 38999,
    image: 'https://images.unsplash.com/photo-1686455746285-4a921419bc6c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxTaW5nYXBvcmUlMjBNYXJpbmElMjBCYXl8ZW58MXx8fHwxNzY5MTI4NDUzfDA&ixlib=rb-4.1.0&q=80&w=1080',
    inclusions: ['Flights', 'Hotel', 'Universal Studios', 'Gardens by the Bay'],
    type: 'family'
  },
  {
    id: '4',
    title: 'Malaysia Twin Cities',
    destination: 'Malaysia',
    duration: '5D/4N',
    price: 35999,
    image: 'https://images.unsplash.com/photo-1706249085166-bc6e8a0691cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxNYWxheXNpYSUyMFBldHJvbmFzJTIwdG93ZXJzfGVufDF8fHx8MTc2OTE0ODUyNHww&ixlib=rb-4.1.0&q=80&w=1080',
    inclusions: ['Flights', 'Hotels', 'KL Tower', 'Genting Tour'],
    type: 'couple'
  }
];

export const destinations: Destination[] = [
  {
    id: '1',
    name: 'Dubai',
    tagline: 'Where Luxury Meets Adventure',
    image: 'https://images.unsplash.com/photo-1768069794857-9306ac167c6e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxEdWJhaSUyMHNreWxpbmUlMjBzdW5zZXR8ZW58MXx8fHwxNzY5MTQyMjk1fDA&ixlib=rb-4.1.0&q=80&w=1080',
    packages: 12
  },
  {
    id: '2',
    name: 'Bali',
    tagline: 'Island Paradise Awaits',
    image: 'https://images.unsplash.com/photo-1648999637610-a0604610e23f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxCYWxpJTIwYmVhY2glMjB0ZW1wbGV8ZW58MXx8fHwxNzY5MTQ4NTIzfDA&ixlib=rb-4.1.0&q=80&w=1080',
    packages: 10
  },
  {
    id: '3',
    name: 'Singapore',
    tagline: 'The Garden City Experience',
    image: 'https://images.unsplash.com/photo-1686455746285-4a921419bc6c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxTaW5nYXBvcmUlMjBNYXJpbmElMjBCYXl8ZW58MXx8fHwxNzY5MTI4NDUzfDA&ixlib=rb-4.1.0&q=80&w=1080',
    packages: 8
  },
  {
    id: '4',
    name: 'Malaysia',
    tagline: 'Truly Asia Experience',
    image: 'https://images.unsplash.com/photo-1706249085166-bc6e8a0691cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxNYWxheXNpYSUyMFBldHJvbmFzJTIwdG93ZXJzfGVufDF8fHx8MTc2OTE0ODUyNHww&ixlib=rb-4.1.0&q=80&w=1080',
    packages: 9
  }
];

export const testimonials: Testimonial[] = [
  {
    id: '1',
    name: 'Rajesh & Priya Sharma',
    location: 'Mumbai',
    rating: 5,
    comment: 'Amazing Dubai trip! Everything was perfectly organized. YONO DMC took care of every detail. Highly recommend!',
    image: 'https://images.unsplash.com/photo-1614505241347-7f4765c1035e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB0cmF2ZWwlMjB2YWNhdGlvbnxlbnwxfHx8fDE3NjkwNjI4ODF8MA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: '2',
    name: 'Amit & Sneha Patel',
    location: 'Ahmedabad',
    rating: 5,
    comment: 'Our Bali honeymoon was a dream come true! Thank you YONO DMC for making it so special and hassle-free.',
    image: 'https://images.unsplash.com/photo-1614505241347-7f4765c1035e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB0cmF2ZWwlMjB2YWNhdGlvbnxlbnwxfHx8fDE3NjkwNjI4ODF8MA&ixlib=rb-4.1.0&q=80&w=1080'
  },
  {
    id: '3',
    name: 'Vikram Reddy',
    location: 'Bangalore',
    rating: 5,
    comment: 'Best travel agency! Got the best rates and amazing service. Singapore trip was fantastic!',
    image: 'https://images.unsplash.com/photo-1614505241347-7f4765c1035e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjB0cmF2ZWwlMjB2YWNhdGlvbnxlbnwxfHx8fDE3NjkwNjI4ODF8MA&ixlib=rb-4.1.0&q=80&w=1080'
  }
];

export const whatsappNumber = '+919876543210';
export const whatsappLink = `https://wa.me/${whatsappNumber.replace('+', '')}`;
