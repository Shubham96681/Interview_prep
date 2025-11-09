import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DialogFooter } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface AddUserFormProps {
  onSave: (data: any) => void;
  onCancel: () => void;
}

export default function AddUserForm({ onSave, onCancel }: AddUserFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    userType: 'candidate' as 'candidate' | 'expert' | 'admin',
    password: '',
    bio: '',
    experience: '',
    skills: [] as string[],
    hourlyRate: '',
    isVerified: false,
    isActive: true
  });
  const [skillInput, setSkillInput] = useState('');

  const handleAddSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, skillInput.trim()] });
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setFormData({ ...formData, skills: formData.skills.filter(s => s !== skill) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.userType) {
      toast.error('Please fill in all required fields');
      return;
    }

    const submitData = {
      ...formData,
      hourlyRate: formData.hourlyRate ? parseFloat(formData.hourlyRate) : null,
      skills: formData.skills.length > 0 ? formData.skills : null
    };
    onSave(submitData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="userType">User Type *</Label>
          <Select
            value={formData.userType}
            onValueChange={(value: 'candidate' | 'expert' | 'admin') => setFormData({ ...formData, userType: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="candidate">Candidate</SelectItem>
              <SelectItem value="expert">Expert</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Leave empty for auto-generated"
          />
        </div>
      </div>

      {formData.userType === 'expert' && (
        <>
          <div>
            <Label htmlFor="bio">Bio</Label>
            <Input
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Expert bio/description"
            />
          </div>
          <div>
            <Label htmlFor="experience">Experience</Label>
            <Input
              id="experience"
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              placeholder="Years of experience or description"
            />
          </div>
          <div>
            <Label htmlFor="hourlyRate">Hourly Rate</Label>
            <Input
              id="hourlyRate"
              type="number"
              step="0.01"
              value={formData.hourlyRate}
              onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label>Skills</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
                placeholder="Add a skill and press Enter"
              />
              <Button type="button" variant="outline" onClick={handleAddSkill}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.skills.map((skill) => (
                <Badge key={skill} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveSkill(skill)}>
                  {skill} ×
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="rounded"
          />
          <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
        </div>
        {formData.userType === 'expert' && (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isVerified"
              checked={formData.isVerified}
              onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="isVerified" className="cursor-pointer">Verified</Label>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Create User</Button>
      </DialogFooter>
    </form>
  );
}

