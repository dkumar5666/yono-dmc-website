// Mock data for Yono DMC website

export interface Package {
  id: string;
  slug: string;
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
  country?: string;
  cities?: string[];
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
    slug: 'dubai',
    title: 'Magical Dubai Experience',
    destination: 'Dubai',
    duration: '5D/4N',
    price: 45999,
    image: '/api/images/dubai',
    inclusions: ['Flights', 'Hotels', 'Transfers', 'City Tour'],
    type: 'family'
  },
  {
    id: '2',
    slug: 'bali',
    title: 'Romantic Bali Getaway',
    destination: 'Bali',
    duration: '6D/5N',
    price: 52999,
    image: '/api/images/bali',
    inclusions: ['Flights', '5* Resort', 'Meals', 'Spa'],
    type: 'honeymoon'
  },
  {
    id: '3',
    slug: 'singapore',
    title: 'Singapore City Delights',
    destination: 'Singapore',
    duration: '4D/3N',
    price: 38999,
    image: '/api/images/singapore',
    inclusions: ['Flights', 'Hotel', 'Universal Studios', 'Gardens by the Bay'],
    type: 'family'
  },
  {
    id: '4',
    slug: 'malaysia',
    title: 'Malaysia Twin Cities',
    destination: 'Malaysia',
    duration: '5D/4N',
    price: 35999,
    image: '/api/images/malaysia',
    inclusions: ['Flights', 'Hotels', 'KL Tower', 'Genting Tour'],
    type: 'couple'
  }
];

export const destinations: Destination[] = [
  {
    id: '1',
    name: 'Dubai',
    country: 'UAE',
    cities: ['Dubai', 'Abu Dhabi'],
    tagline: 'Where Luxury Meets Adventure',
    image: '/api/images/dubai',
    packages: 12
  },
  {
    id: '2',
    name: 'Bali',
    country: 'Indonesia',
    cities: ['Bali', 'Ubud', 'Kuta'],
    tagline: 'Island Paradise Awaits',
    image: '/api/images/bali',
    packages: 10
  },
  {
    id: '3',
    name: 'Singapore',
    country: 'Singapore',
    cities: ['Singapore City', 'Sentosa'],
    tagline: 'The Garden City Experience',
    image: '/api/images/singapore',
    packages: 8
  },
  {
    id: '4',
    name: 'Malaysia',
    country: 'Malaysia',
    cities: ['Genting Highlands', 'Penang', 'Langkawi'],
    tagline: 'Truly Asia Experience',
    image: '/api/images/malaysia',
    packages: 9
  }
];

export const testimonials: Testimonial[] = [
  {
    id: '1',
    name: 'Rajesh & Priya Sharma',
    location: 'Mumbai',
    rating: 5,
    comment: 'Amazing Dubai trip! Everything was perfectly organized. Yono DMC took care of every detail. Highly recommend!',
    image: '/api/images/testimonial'
  },
  {
    id: '2',
    name: 'Amit & Sneha Patel',
    location: 'Ahmedabad',
    rating: 5,
    comment: 'Our Bali honeymoon was a dream come true! Thank you Yono DMC for making it so special and hassle-free.',
    image: '/api/images/testimonial'
  },
  {
    id: '3',
    name: 'Vikram Reddy',
    location: 'Bangalore',
    rating: 5,
    comment: 'Best travel agency! Got the best rates and amazing service. Singapore trip was fantastic!',
    image: '/api/images/testimonial'
  }
];

export const whatsappNumber = '+919876543210';
export const whatsappLink = `https://wa.me/${whatsappNumber.replace('+', '')}`;
