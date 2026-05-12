const crypto = require('crypto');

// Validation functions to test
const validatePassword = (password) => {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.';
  if (!/\d/.test(password)) return 'Password must contain a digit.';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    return 'Password must contain a special character.';
  return null;
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateCompanyCode = (code, approvedCode = 'ARCH2026') => {
  return code === approvedCode;
};

describe('Validation Functions', () => {
  describe('validatePassword', () => {
    it('should accept valid password', () => {
      const result = validatePassword('Valid@Pass123');
      expect(result).toBeNull();
    });

    it('should reject password shorter than 8 characters', () => {
      const result = validatePassword('Short@1');
      expect(result).toContain('at least 8 characters');
    });

    it('should reject password without uppercase letter', () => {
      const result = validatePassword('valid@pass123');
      expect(result).toContain('uppercase letter');
    });

    it('should reject password without lowercase letter', () => {
      const result = validatePassword('VALID@PASS123');
      expect(result).toContain('lowercase letter');
    });

    it('should reject password without digit', () => {
      const result = validatePassword('Valid@PassABC');
      expect(result).toContain('digit');
    });

    it('should reject password without special character', () => {
      const result = validatePassword('ValidPass123');
      expect(result).toContain('special character');
    });

    it('should accept password with various special characters', () => {
      const passwords = [
        'Test@Pass123',
        'Test!Pass123',
        'Test#Pass123',
        'Test$Pass123',
        'Test%Pass123',
      ];

      passwords.forEach((pwd) => {
        expect(validatePassword(pwd)).toBeNull();
      });
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      const emails = [
        'test@example.com',
        'user.name@example.co.uk',
        'name+tag@example.com',
        'first.last@subdomain.example.com',
      ];

      emails.forEach((email) => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@.com',
        'user name@example.com',
        'user@example',
      ];

      invalidEmails.forEach((email) => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('validateCompanyCode', () => {
    it('should accept valid company code', () => {
      expect(validateCompanyCode('ARCH2026', 'ARCH2026')).toBe(true);
    });

    it('should reject invalid company code', () => {
      expect(validateCompanyCode('INVALID', 'ARCH2026')).toBe(false);
    });

    it('should use default company code if not provided', () => {
      expect(validateCompanyCode('ARCH2026')).toBe(true);
      expect(validateCompanyCode('OTHER')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(validateCompanyCode('arch2026', 'ARCH2026')).toBe(false);
    });
  });
});

describe('Password Hashing', () => {
  const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
    const hash = crypto.createHmac('sha256', salt).update(password).digest('hex');
    return `${salt}:${hash}`;
  };

  const verifyPassword = (password, hash) => {
    const [salt, storedHash] = hash.split(':');
    const newHash = crypto.createHmac('sha256', salt).update(password).digest('hex');
    return newHash === storedHash;
  };

  it('should hash password with salt', () => {
    const password = 'Test@Pass123';
    const hashed = hashPassword(password);

    expect(hashed).toContain(':');
    expect(hashed).not.toBe(password);
  });

  it('should verify correct password', () => {
    const password = 'Test@Pass123';
    const hashed = hashPassword(password);

    expect(verifyPassword(password, hashed)).toBe(true);
  });

  it('should reject incorrect password', () => {
    const password = 'Test@Pass123';
    const hashed = hashPassword(password);

    expect(verifyPassword('Wrong@Pass123', hashed)).toBe(false);
  });

  it('should produce different hashes for same password (due to salt)', () => {
    const password = 'Test@Pass123';
    const hash1 = hashPassword(password);
    const hash2 = hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(verifyPassword(password, hash1)).toBe(true);
    expect(verifyPassword(password, hash2)).toBe(true);
  });
});
