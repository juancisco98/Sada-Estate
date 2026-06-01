import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createSupabaseMock, getActiveSupabaseClient } from './mocks/supabase';

// Mock del cliente real de Supabase. La factory lee del registro de mock activo
// (ver test/mocks/supabase.ts) para sortear el hoisting de vi.mock.
vi.mock('@/services/supabaseClient', () => ({
  get supabase() {
    return getActiveSupabaseClient();
  },
  signInWithGoogle: (...args: any[]) =>
    getActiveSupabaseClient().auth.signInWithOAuth(...args),
  signOut: () => getActiveSupabaseClient().auth.signOut(),
}));

import AuthScreen from '@/components/AuthScreen';

describe('Bala trazadora: el harness de tests funciona end-to-end', () => {
  let sb: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    sb = createSupabaseMock({
      tenants: [
        { id: 't1', email: 'inquilino@example.com', name: 'Inquilino Uno' },
      ],
      allowed_emails: [{ email: 'juan.sada98@gmail.com' }],
    });
  });

  describe('contrato del mock de Supabase', () => {
    it('select + ilike + limit + maybeSingle devuelve la fila sembrada', async () => {
      const { data, error } = await sb.client
        .from('tenants')
        .select('*')
        .ilike('email', 'INQUILINO@example.com')
        .limit(1)
        .maybeSingle();

      expect(error).toBeNull();
      expect(data).toMatchObject({ id: 't1', name: 'Inquilino Uno' });
    });

    it('maybeSingle devuelve PGRST116 ante filas duplicadas (Lección 10)', async () => {
      sb.store.tenants.push({
        id: 't2',
        email: 'inquilino@example.com',
        name: 'Duplicado',
      });

      const { data, error } = await sb.client
        .from('tenants')
        .select('*')
        .ilike('email', 'inquilino@example.com')
        .maybeSingle();

      expect(data).toBeNull();
      expect(error?.code).toBe('PGRST116');
    });

    it('insert se refleja en el store', async () => {
      await sb.client.from('tenants').insert({ id: 't9', email: 'nuevo@x.com' });
      expect(sb.store.tenants).toHaveLength(2);
      expect(sb.spies.insert).toHaveBeenCalledWith('tenants', {
        id: 't9',
        email: 'nuevo@x.com',
      });
    });

    it('forceError simula una violación de FK (código 23503)', async () => {
      sb.forceError('tenants', 'insert', {
        code: '23503',
        message: 'foreign key constraint',
      });

      const { error } = await sb.client
        .from('tenants')
        .insert({ id: 'tX', property_id: 'no-existe' });

      expect(error?.code).toBe('23503');
    });
  });

  describe('render con React Testing Library', () => {
    it('monta AuthScreen y muestra el botón de Google', () => {
      render(<AuthScreen />);
      expect(screen.getByText('Continuar con Google')).toBeInTheDocument();
      expect(screen.getByText('SV Propiedades')).toBeInTheDocument();
    });

    it('al hacer click en el botón llama a signInWithGoogle → auth de Supabase', async () => {
      const user = userEvent.setup();
      render(<AuthScreen />);

      await user.click(screen.getByRole('button', { name: /Continuar con Google/i }));

      expect(sb.spies.signInWithOAuth).toHaveBeenCalledTimes(1);
    });
  });
});
