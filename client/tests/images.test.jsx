import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '../src/context/ToastContext.jsx';
import ImagePicker from '../src/components/ImagePicker.jsx';
import ItemCard from '../src/components/ItemCard.jsx';
import CreateReport from '../src/pages/CreateReport.jsx';
import EditReport from '../src/pages/EditReport.jsx';

vi.mock('../src/api/config.js', () => ({ getConfig: vi.fn() }));
vi.mock('../src/api/items.js', () => ({
  listItems: vi.fn(), listMyItems: vi.fn(), getItem: vi.fn(), createItem: vi.fn(), updateItem: vi.fn(), withdrawItem: vi.fn(),
  getMatches: vi.fn(), reportListing: vi.fn(), uploadItemImage: vi.fn(), deleteItemImage: vi.fn(),
}));
import { getConfig } from '../src/api/config.js';
import { getItem, createItem, updateItem, uploadItemImage, deleteItemImage } from '../src/api/items.js';

const file = (name = 'photo.png', type = 'image/png', size = 1024) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};
const choose = (input, f) => fireEvent.change(input, { target: { files: [f] } });

beforeEach(() => {
  vi.clearAllMocks();
  getConfig.mockResolvedValue({ uploadsEnabled: true });
});

describe('ImagePicker', () => {
  const setup = (props = {}) => {
    const onFileChange = vi.fn();
    const onRemoveExistingChange = vi.fn();
    render(<ImagePicker file={null} onFileChange={onFileChange} onRemoveExistingChange={onRemoveExistingChange} removeExisting={false} {...props} />);
    return { onFileChange, onRemoveExistingChange, input: screen.getByLabelText('Photo (optional)') };
  };

  it('accepts a JPEG, PNG or WebP within the size limit', () => {
    const { input, onFileChange } = setup();
    const png = file('a.png', 'image/png');
    choose(input, png);
    expect(onFileChange).toHaveBeenCalledWith(png);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['a text file', file('a.txt', 'text/plain'), /choose a jpeg, png or webp/i],
    ['an SVG', file('a.svg', 'image/svg+xml'), /choose a jpeg, png or webp/i],
    ['a GIF', file('a.gif', 'image/gif'), /choose a jpeg, png or webp/i],
    ['a 4 MB image', file('big.png', 'image/png', 4 * 1024 * 1024), /too large \(maximum 3 mb\)/i],
  ])('rejects %s without selecting it', (_l, f, message) => {
    const { input, onFileChange } = setup();
    choose(input, f);
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(onFileChange).not.toHaveBeenCalled();
  });

  it('lets the person remove a chosen file', () => {
    const { onFileChange } = setup({ file: file() });
    expect(screen.getByText('photo.png')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /remove chosen photo/i }));
    expect(onFileChange).toHaveBeenCalledWith(null);
  });

  it('shows the current photo and can mark it for removal and undo that', () => {
    const { onRemoveExistingChange } = setup({ existingUrl: 'https://res.cloudinary.com/demo/a.png' });
    expect(screen.getByAltText('Current photo of the item')).toHaveAttribute('src', 'https://res.cloudinary.com/demo/a.png');
    fireEvent.click(screen.getByRole('button', { name: /^remove photo$/i }));
    expect(onRemoveExistingChange).toHaveBeenCalledWith(true);
  });

  it('explains that the photo will be removed on save', () => {
    const { onRemoveExistingChange } = setup({ existingUrl: 'https://res.cloudinary.com/demo/a.png', removeExisting: true });
    expect(screen.getByText(/will be removed when you save/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /keep photo/i }));
    expect(onRemoveExistingChange).toHaveBeenCalledWith(false);
  });
});

describe('ItemCard photo', () => {
  const card = (imageUrl) => render(
    <MemoryRouter>
      <ul><ItemCard item={{ id: '1', type: 'LOST', title: 'Black wallet', category: 'WALLETS_PURSES', description: 'Lost it.', location: 'Library', dateOccurred: '2026-10-10T00:00:00.000Z', status: 'ACTIVE', imageUrl }} /></ul>
    </MemoryRouter>,
  );

  it('shows the photo with a useful alt text when there is one', () => {
    card('https://res.cloudinary.com/demo/a.png');
    expect(screen.getByAltText('Photo of Black wallet')).toHaveAttribute('src', 'https://res.cloudinary.com/demo/a.png');
  });

  it('shows no image element when there is none', () => {
    card('');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('creating a report with a photo', () => {
  const renderCreate = () => render(
    <MemoryRouter initialEntries={['/report']}>
      <ToastProvider>
        <Routes>
          <Route path="/report" element={<CreateReport type="LOST" />} />
          <Route path="/items/:id" element={<h1>Details page</h1>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
  const fillAndSubmit = async () => {
    const t = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    t('Title', 'Black wallet'); t('Category', 'WALLETS_PURSES'); t('Description', 'Lost near the library entrance.');
    t('Date', '2026-10-10'); t('General location', 'Library');
    fireEvent.click(screen.getByRole('button', { name: /publish report/i }));
  };

  it('uploads the chosen photo after the report is created', async () => {
    createItem.mockResolvedValue({ id: 'abc' });
    uploadItemImage.mockResolvedValue({});
    renderCreate();
    const picker = await screen.findByLabelText('Photo (optional)');
    const photo = file();
    choose(picker, photo);
    await fillAndSubmit();
    expect(await screen.findByRole('heading', { name: 'Details page' })).toBeInTheDocument();
    expect(createItem).toHaveBeenCalledTimes(1);
    expect(uploadItemImage).toHaveBeenCalledWith('abc', photo);
    expect(createItem.mock.calls[0][0]).not.toHaveProperty('image');
  });

  it('keeps the report and says so when the photo upload fails', async () => {
    createItem.mockResolvedValue({ id: 'abc' });
    uploadItemImage.mockRejectedValue({ response: { status: 502, data: { message: 'The image service could not process the upload.' } } });
    renderCreate();
    choose(await screen.findByLabelText('Photo (optional)'), file());
    await fillAndSubmit();
    expect(await screen.findByRole('heading', { name: 'Details page' })).toBeInTheDocument();
    expect(await screen.findByText(/report is published, but the photo could not be uploaded/i)).toBeInTheDocument();
  });

  it('does not call the upload endpoint when no photo was chosen', async () => {
    createItem.mockResolvedValue({ id: 'abc' });
    renderCreate();
    await screen.findByLabelText('Photo (optional)');
    await fillAndSubmit();
    await screen.findByRole('heading', { name: 'Details page' });
    expect(uploadItemImage).not.toHaveBeenCalled();
  });

  it('hides the photo field entirely when the server has no image storage configured', async () => {
    getConfig.mockResolvedValue({ uploadsEnabled: false });
    renderCreate();
    await screen.findByLabelText('Title');
    await waitFor(() => expect(getConfig).toHaveBeenCalled());
    expect(screen.queryByLabelText('Photo (optional)')).not.toBeInTheDocument();
  });
});

describe('editing a report photo', () => {
  const item = { id: 'i1', type: 'LOST', title: 'Black wallet', category: 'WALLETS_PURSES', description: 'Lost near the library entrance.', dateOccurred: '2026-10-10T00:00:00.000Z', approxTime: '', location: 'Library', contactPreference: 'IN_APP', status: 'ACTIVE', isOwner: true, imageUrl: 'https://res.cloudinary.com/demo/a.png' };
  const renderEdit = () => render(
    <MemoryRouter initialEntries={['/items/i1/edit']}>
      <ToastProvider>
        <Routes>
          <Route path="/items/:id/edit" element={<EditReport />} />
          <Route path="/items/:id" element={<h1>Details page</h1>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );

  it('removes the photo when asked, after saving the changes', async () => {
    getItem.mockResolvedValue(item);
    updateItem.mockResolvedValue(item);
    deleteItemImage.mockResolvedValue({});
    renderEdit();
    fireEvent.click(await screen.findByRole('button', { name: /^remove photo$/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByRole('heading', { name: 'Details page' })).toBeInTheDocument();
    expect(updateItem).toHaveBeenCalled();
    expect(deleteItemImage).toHaveBeenCalledWith('i1');
    expect(uploadItemImage).not.toHaveBeenCalled();
  });

  it('replaces the photo with a newly chosen one', async () => {
    getItem.mockResolvedValue(item);
    updateItem.mockResolvedValue(item);
    uploadItemImage.mockResolvedValue({});
    renderEdit();
    const picker = await screen.findByLabelText('Photo (optional)');
    const next = file('new.jpg', 'image/jpeg');
    choose(picker, next);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await screen.findByRole('heading', { name: 'Details page' });
    expect(uploadItemImage).toHaveBeenCalledWith('i1', next);
    expect(deleteItemImage).not.toHaveBeenCalled();
  });
});
