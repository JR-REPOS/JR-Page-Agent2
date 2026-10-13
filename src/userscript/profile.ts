export interface UserProfile {
  firstName: string;
  middleName: string;
  surname: string;
  nickname: string;
  age: string;
  gender: string;
  pronouns: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  occupation: string;
  company: string;
  website: string;
  likes: string;
  hobbies: string;
  about: string;
  additionalNotes: string;
}

const PROFILE_KEY = 'PAGE_AGENT_USER_PROFILE_V1';

export const EMPTY_PROFILE: UserProfile = {
  firstName: '', middleName: '', surname: '', nickname: '', age: '', gender: '', pronouns: '',
  email: '', phone: '', address: '', city: '', region: '', postalCode: '', country: '',
  occupation: '', company: '', website: '', likes: '', hobbies: '', about: '', additionalNotes: '',
};

export function getProfile(): UserProfile {
  try { return { ...EMPTY_PROFILE, ...GM_getValue<Partial<UserProfile>>(PROFILE_KEY, {}) }; }
  catch { return { ...EMPTY_PROFILE }; }
}

export function saveProfile(profile: UserProfile): void {
  const clean = Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, value.trim()])) as unknown as UserProfile;
  GM_setValue(PROFILE_KEY, clean);
}

export function clearProfile(): UserProfile {
  GM_deleteValue(PROFILE_KEY);
  return { ...EMPTY_PROFILE };
}

export function profileForPrompt(profile: UserProfile): string {
  const labels: Record<keyof UserProfile, string> = {
    firstName: 'First name', middleName: 'Middle name', surname: 'Surname', nickname: 'Nickname',
    age: 'Age', gender: 'Gender/sex', pronouns: 'Pronouns', email: 'Email', phone: 'Phone',
    address: 'Street address', city: 'City', region: 'State/region', postalCode: 'Postal code',
    country: 'Country', occupation: 'Occupation', company: 'Company', website: 'Website', likes: 'Likes',
    hobbies: 'Hobbies', about: 'About', additionalNotes: 'Additional notes',
  };
  const lines = (Object.keys(profile) as Array<keyof UserProfile>)
    .filter(key => profile[key])
    .map(key => `- ${labels[key]}: ${profile[key]}`);
  return lines.length ? `\nUser-provided profile (use only when relevant; ask before submitting it):\n${lines.join('\n')}` : '';
}
