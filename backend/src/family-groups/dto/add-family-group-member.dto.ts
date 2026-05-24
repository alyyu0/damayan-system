export class AddFamilyGroupMemberDto {
  familyGroupId: string;
  citizenQrCodeId: string;
  memberUserId?: string;
  memberFullName?: string;
  relationship?: string;
}
