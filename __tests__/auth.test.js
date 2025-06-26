// Mock pentru Firebase Auth
jest.mock('../config/firebase', () => ({
    auth: {
        currentUser: { uid: 'test-user-id', email: 'test@example.com' }
    },
    db: {}
}));

// Mock pentru React Native Alert
jest.mock('react-native', () => ({
    Alert: {
        alert: jest.fn()
    }
}));

// Funcții de validare pentru autentificare
const validateRegistrationData = (userData) => {
    const { username, email, password, phone, fullName } = userData;

    if (!email || !password || !username || !phone || !fullName) {
        return { isValid: false, message: 'Toate câmpurile sunt obligatorii!' };
    }

    // Validare email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { isValid: false, message: 'Adresa de email nu este validă!' };
    }

    // Validare parolă
    if (password.length < 6) {
        return { isValid: false, message: 'Parola trebuie să aibă cel puțin 6 caractere!' };
    }

    // Validare telefon
    const phoneRegex = /^[0-9+\-\s\(\)]{10,}$/;
    if (!phoneRegex.test(phone)) {
        return { isValid: false, message: 'Numărul de telefon nu este valid!' };
    }

    return { isValid: true, message: 'Datele sunt valide' };
};

const validateLoginData = (loginData) => {
    const { email, password } = loginData;

    if (!email || !password) {
        return { isValid: false, message: 'Email și parola sunt obligatorii!' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { isValid: false, message: 'Adresa de email nu este validă!' };
    }

    return { isValid: true, message: 'Datele de login sunt valide' };
};

const validateVerificationCode = (code) => {
    if (!code) {
        return { isValid: false, message: 'Codul de verificare este obligatoriu!' };
    }

    if (code.length !== 4) {
        return { isValid: false, message: 'Codul trebuie să aibă 4 cifre!' };
    }

    if (!/^\d{4}$/.test(code)) {
        return { isValid: false, message: 'Codul poate conține doar cifre!' };
    }

    return { isValid: true, message: 'Codul este valid' };
};

const validatePasswordReset = (password, confirmPassword) => {
    if (!password || !confirmPassword) {
        return { isValid: false, message: 'Te rugăm să completezi ambele câmpuri.' };
    }

    if (password !== confirmPassword) {
        return { isValid: false, message: 'Parolele nu coincid.' };
    }

    if (password.length < 6) {
        return { isValid: false, message: 'Parola trebuie să aibă cel puțin 6 caractere.' };
    }

    return { isValid: true, message: 'Parola este validă' };
};

describe('Testare funcții de autentificare', () => {
    describe('validateRegistrationData', () => {
        test('validează date complete și corecte de înregistrare', () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123',
                phone: '0712345678',
                fullName: 'Test User'
            };

            const result = validateRegistrationData(userData);
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Datele sunt valide');
        });

        test('respinge date incomplete', () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: '',
                phone: '0712345678',
                fullName: 'Test User'
            };

            const result = validateRegistrationData(userData);
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Toate câmpurile sunt obligatorii!');
        });

        test('respinge email invalid', () => {
            const userData = {
                username: 'testuser',
                email: 'email-invalid',
                password: 'password123',
                phone: '0712345678',
                fullName: 'Test User'
            };

            const result = validateRegistrationData(userData);
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Adresa de email nu este validă!');
        });

        test('respinge parolă prea scurtă', () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: '123',
                phone: '0712345678',
                fullName: 'Test User'
            };

            const result = validateRegistrationData(userData);
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Parola trebuie să aibă cel puțin 6 caractere!');
        });

        test('respinge număr de telefon invalid', () => {
            const userData = {
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123',
                phone: '123',
                fullName: 'Test User'
            };

            const result = validateRegistrationData(userData);
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Numărul de telefon nu este valid!');
        });
    });

    describe('validateLoginData', () => {
        test('validează date corecte de login', () => {
            const loginData = {
                email: 'test@example.com',
                password: 'password123'
            };

            const result = validateLoginData(loginData);
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Datele de login sunt valide');
        });

        test('respinge date incomplete', () => {
            const loginData = {
                email: 'test@example.com',
                password: ''
            };

            const result = validateLoginData(loginData);
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Email și parola sunt obligatorii!');
        });

        test('respinge email invalid', () => {
            const loginData = {
                email: 'invalid-email',
                password: 'password123'
            };

            const result = validateLoginData(loginData);
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Adresa de email nu este validă!');
        });
    });

    describe('validateVerificationCode', () => {
        test('validează cod corect de 4 cifre', () => {
            const result = validateVerificationCode('1234');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Codul este valid');
        });

        test('respinge cod gol', () => {
            const result = validateVerificationCode('');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Codul de verificare este obligatoriu!');
        });

        test('respinge cod cu lungime incorectă', () => {
            const result = validateVerificationCode('123');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Codul trebuie să aibă 4 cifre!');
        });

        test('respinge cod cu caractere non-numerice', () => {
            const result = validateVerificationCode('12ab');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Codul poate conține doar cifre!');
        });
    });

    describe('validatePasswordReset', () => {
        test('validează parole identice și puternice', () => {
            const result = validatePasswordReset('newpassword123', 'newpassword123');
            expect(result.isValid).toBe(true);
            expect(result.message).toBe('Parola este validă');
        });

        test('respinge parole care nu coincid', () => {
            const result = validatePasswordReset('password1', 'password2');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Parolele nu coincid.');
        });

        test('respinge parole prea scurte', () => {
            const result = validatePasswordReset('123', '123');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Parola trebuie să aibă cel puțin 6 caractere.');
        });

        test('respinge câmpuri goale', () => {
            const result = validatePasswordReset('', '');
            expect(result.isValid).toBe(false);
            expect(result.message).toBe('Te rugăm să completezi ambele câmpuri.');
        });
    });
}); 